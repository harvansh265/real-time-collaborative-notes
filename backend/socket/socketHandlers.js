const { Chat, Message } = require("../models/Chat")
const Note = require("../models/Note")
const User = require("../models/User")

const connectedUsers = new Map()

module.exports = (io, socket) => {
  // Store user connection
  connectedUsers.set(socket.userId, socket.id)

  // Join user to their personal room
  socket.join(`user_${socket.userId}`)

  // Update user online status when they connect and broadcast to relevant users
  const updateUserOnlineStatus = async (userId, isOnline) => {
    try {
      await User.findByIdAndUpdate(userId, {
        isOnline,
        lastSeen: new Date(),
      })

      // Find all chats where this user is a participant
      const userChats = await Chat.find({
        "participants.user": userId,
      }).populate("participants.user", "_id")

      // Get all unique user IDs from these chats (excluding the current user)
      const relevantUserIds = new Set()
      userChats.forEach((chat) => {
        chat.participants.forEach((participant) => {
          if (participant.user._id.toString() !== userId) {
            relevantUserIds.add(participant.user._id.toString())
          }
        })
      })

      // Broadcast status change to all relevant users
      relevantUserIds.forEach((relevantUserId) => {
        io.to(`user_${relevantUserId}`).emit("user_status_changed", {
          userId,
          isOnline,
          username: socket.user.username,
        })
      })

      console.log(`User ${socket.user.username} is now ${isOnline ? "online" : "offline"}`)
    } catch (error) {
      console.error("Error updating user online status:", error)
    }
  }

  // Set user online when they connect
  updateUserOnlineStatus(socket.userId, true)

  // Join user to their chat rooms
  socket.on("join_chats", async () => {
    try {
      const chats = await Chat.find({
        "participants.user": socket.userId,
      })

      chats.forEach((chat) => {
        socket.join(`chat_${chat._id}`)
      })
    } catch (error) {
      console.error("Join chats error:", error)
    }
  })

  // Handle new message
  socket.on("send_message", async (data) => {
    try {
      const { chatId, content, messageType = "text", sharedNote } = data

      // Verify user is participant
      const chat = await Chat.findOne({
        _id: chatId,
        "participants.user": socket.userId,
      })

      if (!chat) {
        socket.emit("error", { message: "Chat not found" })
        return
      }

      const message = new Message({
        chat: chatId,
        sender: socket.userId,
        content,
        messageType,
        sharedNote,
      })

      await message.save()
      await message.populate("sender", "username email")

      // If it's a note message, populate the shared note and grant access to chat participants
      if (sharedNote && messageType === "note") {
        try {
          // Find the note and make sure all chat participants can access it
          const note = await Note.findById(sharedNote)
          if (note) {
            // Add all chat participants to the note's sharedWith array if they're not already there
            const chatParticipants = chat.participants.map((p) => p.user.toString())
            const currentSharedUsers = note.sharedWith.map((s) => s.user.toString())

            // Find participants who don't already have access
            const newSharedUsers = chatParticipants.filter(
              (participantId) => participantId !== note.owner.toString() && !currentSharedUsers.includes(participantId),
            )

            // Add new participants to sharedWith with write permission (so they can edit)
            if (newSharedUsers.length > 0) {
              const newShares = newSharedUsers.map((userId) => ({
                user: userId,
                permission: "write", // Changed from "read" to "write" to allow editing
              }))
              note.sharedWith.push(...newShares)
              await note.save()
              console.log(`Added ${newSharedUsers.length} users to note access with write permission`)

              // Notify all users who got access to the note that they can now access it
              newSharedUsers.forEach((userId) => {
                io.to(`user_${userId}`).emit("note_shared_with_you", {
                  noteId: note._id,
                  noteTitle: note.title,
                  sharedBy: socket.user.username,
                })
              })
            }

            // Always populate the message with note data for immediate display
            await message.populate("sharedNote", "title content owner labels color updatedAt")
          }
        } catch (noteError) {
          console.error("Error processing shared note:", noteError)
        }
      }

      // Check if any participants have deleted this chat and restore it for them
      const participantsToRestore = []
      for (const participant of chat.participants) {
        if (participant.isDeleted && participant.user.toString() !== socket.userId) {
          // Restore the chat for this participant
          participant.isDeleted = false
          participant.isArchived = false // Also unarchive if it was archived
          participantsToRestore.push(participant.user.toString())
        }
      }

      // Update chat's last message and save
      chat.lastMessage = message._id
      chat.updatedAt = new Date()
      await chat.save()

      // Log restoration if any participants were restored
      if (participantsToRestore.length > 0) {
        console.log(`Restored chat ${chatId} for participants:`, participantsToRestore)
      }

      // Emit to all participants in the chat room
      io.to(`chat_${chatId}`).emit("new_message", message)

      // For participants who had deleted the chat, emit a special event
      // so they know to refresh their chat list
      participantsToRestore.forEach((userId) => {
        io.to(`user_${userId}`).emit("chat_restored", {
          chatId,
          message: "Chat restored due to new message",
        })
      })
    } catch (error) {
      console.error("Send message error:", error)
      socket.emit("error", { message: "Failed to send message" })
    }
  })

  // Handle typing indicators
  socket.on("typing_start", (data) => {
    socket.to(`chat_${data.chatId}`).emit("user_typing", {
      userId: socket.userId,
      username: socket.user.username,
    })
  })

  socket.on("typing_stop", (data) => {
    socket.to(`chat_${data.chatId}`).emit("user_stop_typing", {
      userId: socket.userId,
    })
  })

  // Handle note collaboration
  socket.on("join_note", async (noteId) => {
    try {
      // Verify user has access to note
      const note = await Note.findOne({
        _id: noteId,
        $or: [{ owner: socket.userId }, { "sharedWith.user": socket.userId }],
      })

      if (note) {
        socket.join(`note_${noteId}`)
        socket.to(`note_${noteId}`).emit("user_joined_note", {
          userId: socket.userId,
          username: socket.user.username,
        })
        console.log(`User ${socket.user.username} joined note ${noteId}`)
      } else {
        console.log(`User ${socket.user.username} denied access to note ${noteId}`)
      }
    } catch (error) {
      console.error("Join note error:", error)
    }
  })

  socket.on("leave_note", (noteId) => {
    socket.leave(`note_${noteId}`)
    socket.to(`note_${noteId}`).emit("user_left_note", {
      userId: socket.userId,
      username: socket.user.username,
    })
    console.log(`User ${socket.user.username} left note ${noteId}`)
  })

  // Handle real-time note updates
  socket.on("note_update", async (data) => {
    try {
      const { noteId, updates } = data

      // Verify user has write access
      const note = await Note.findOne({
        _id: noteId,
        $or: [{ owner: socket.userId }, { "sharedWith.user": socket.userId, "sharedWith.permission": "write" }],
      })

      if (note) {
        // Broadcast to other users in the note room
        socket.to(`note_${noteId}`).emit("note_updated", {
          noteId,
          updates,
          updatedBy: {
            id: socket.userId,
            username: socket.user.username,
          },
        })
        console.log(`Note ${noteId} updated by ${socket.user.username}`)
      }
    } catch (error) {
      console.error("Note update error:", error)
    }
  })

  // Handle note save events (when a note is actually saved to database)
  socket.on("note_saved", async (data) => {
    try {
      const { noteId } = data

      // Find all users who have access to this note
      const note = await Note.findById(noteId)
        .populate("owner", "_id username")
        .populate("sharedWith.user", "_id username")

      if (note) {
        // Get all user IDs who have access to this note
        const accessUserIds = [note.owner._id.toString()]
        note.sharedWith.forEach((share) => {
          accessUserIds.push(share.user._id.toString())
        })

        // Broadcast to all users with access (except the one who saved it)
        accessUserIds.forEach((userId) => {
          if (userId !== socket.userId) {
            io.to(`user_${userId}`).emit("note_list_refresh", {
              noteId,
              message: "A shared note was updated",
            })
          }
        })

        console.log(`Note ${noteId} save broadcasted to ${accessUserIds.length - 1} users`)
      }
    } catch (error) {
      console.error("Note saved broadcast error:", error)
    }
  })

  // Handle chat requests
  socket.on("chat_request", (data) => {
    const { to } = data
    io.to(`user_${to}`).emit("new_chat_request", {
      from: {
        id: socket.userId,
        username: socket.user.username,
      },
    })
  })

  // Handle disconnect
  socket.on("disconnect", () => {
    console.log(`User ${socket.userId} disconnected`)
    connectedUsers.delete(socket.userId)

    // Update user offline status and broadcast to relevant users
    updateUserOnlineStatus(socket.userId, false)
  })
}

// Export connectedUsers for use in routes
module.exports.connectedUsers = connectedUsers
