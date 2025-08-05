const express = require("express")
const { body, validationResult } = require("express-validator")
const { Chat, Message, ChatRequest } = require("../models/Chat")
const auth = require("../middleware/auth")
const { connectedUsers } = require("../socket/socketHandlers")

const router = express.Router()

// Send chat request
router.post(
  "/request",
  [auth, body("to").isMongoId(), body("message").optional().trim().escape()],
  async (req, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() })
      }

      const { to, message } = req.body

      // Check if user is trying to send request to themselves
      if (req.user._id.toString() === to) {
        return res.status(400).json({ message: "Cannot send chat request to yourself" })
      }

      // Check if request already exists (pending)
      const existingRequest = await ChatRequest.findOne({
        $or: [
          { from: req.user._id, to, status: "pending" },
          { from: to, to: req.user._id, status: "pending" },
        ],
      })

      if (existingRequest) {
        return res.status(400).json({ message: "Chat request already exists" })
      }

      const chatRequest = new ChatRequest({
        from: req.user._id,
        to,
        message,
      })

      await chatRequest.save()
      await chatRequest.populate("from", "username email")

      // Emit to the target user about new chat request
      const io = req.app.get("io")
      if (io) {
        io.to(`user_${to}`).emit("new_chat_request", {
          request: chatRequest,
          from: {
            id: req.user._id,
            username: req.user.username,
          },
        })
      }

      res.status(201).json(chatRequest)
    } catch (error) {
      console.error("Send chat request error:", error)
      res.status(500).json({ message: "Server error" })
    }
  },
)

// Get chat requests
router.get("/requests", auth, async (req, res) => {
  try {
    const requests = await ChatRequest.find({
      to: req.user._id,
      status: "pending",
    })
      .populate("from", "username email")
      .sort({ createdAt: -1 })

    res.json(requests)
  } catch (error) {
    console.error("Get chat requests error:", error)
    res.status(500).json({ message: "Server error" })
  }
})

// Respond to chat request
router.patch("/request/:id", [auth, body("status").isIn(["accepted", "rejected"])], async (req, res) => {
  try {
    const { status } = req.body

    const chatRequest = await ChatRequest.findOne({
      _id: req.params.id,
      to: req.user._id,
      status: "pending",
    }).populate("from", "username email")

    if (!chatRequest) {
      return res.status(404).json({ message: "Chat request not found" })
    }

    chatRequest.status = status
    await chatRequest.save()

    // If accepted, create a chat
    if (status === "accepted") {
      const chat = new Chat({
        participants: [
          { user: chatRequest.from._id, role: "member" },
          { user: req.user._id, role: "member" },
        ],
      })
      await chat.save()
      await chat.populate("participants.user", "username email isOnline")

      // Store io reference for socket emission
      const io = req.app.get("io")
      if (io) {
        // Emit to both users that a new chat was created
        io.to(`user_${chatRequest.from._id}`).emit("chat_created", chat)
        io.to(`user_${req.user._id}`).emit("chat_created", chat)

        // Join both users to the chat room
        const senderSocket = io.sockets.sockets.get(connectedUsers.get(chatRequest.from._id.toString()))
        const receiverSocket = io.sockets.sockets.get(connectedUsers.get(req.user._id.toString()))

        if (senderSocket) {
          senderSocket.join(`chat_${chat._id}`)
        }
        if (receiverSocket) {
          receiverSocket.join(`chat_${chat._id}`)
        }
      }

      return res.json({ chatRequest, chat })
    }

    res.json({ chatRequest })
  } catch (error) {
    console.error("Respond to chat request error:", error)
    res.status(500).json({ message: "Server error" })
  }
})

// Get user chats
router.get("/", auth, async (req, res) => {
  try {
    const { includeArchived = false } = req.query

    // Build the aggregation pipeline
    const pipeline = [
      {
        $match: {
          "participants.user": req.user._id,
        },
      },
      {
        $addFields: {
          currentUserParticipant: {
            $arrayElemAt: [
              {
                $filter: {
                  input: "$participants",
                  cond: { $eq: ["$$this.user", req.user._id] },
                },
              },
              0,
            ],
          },
        },
      },
      {
        $match: {
          "currentUserParticipant.isDeleted": { $ne: true },
          ...(includeArchived === "true" ? {} : { "currentUserParticipant.isArchived": { $ne: true } }),
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "participants.user",
          foreignField: "_id",
          as: "participantUsers",
        },
      },
      {
        $lookup: {
          from: "messages",
          localField: "lastMessage",
          foreignField: "_id",
          as: "lastMessageData",
        },
      },
      {
        $addFields: {
          participants: {
            $map: {
              input: "$participants",
              as: "participant",
              in: {
                $mergeObjects: [
                  "$$participant",
                  {
                    user: {
                      $arrayElemAt: [
                        {
                          $filter: {
                            input: "$participantUsers",
                            cond: { $eq: ["$$this._id", "$$participant.user"] },
                          },
                        },
                        0,
                      ],
                    },
                  },
                ],
              },
            },
          },
          lastMessage: { $arrayElemAt: ["$lastMessageData", 0] },
        },
      },
      {
        $project: {
          participantUsers: 0,
          lastMessageData: 0,
        },
      },
      {
        $sort: {
          "currentUserParticipant.isPinned": -1,
          updatedAt: -1,
        },
      },
    ]

    const chats = await Chat.aggregate(pipeline)
    // Populate the lastMessage sender if it exists
    await Chat.populate(chats, {
      path: "lastMessage.sender",
      select: "username email",
    })
    
    res.json(chats)
  } catch (error) {
    console.error("Get chats error:", error)
    res.status(500).json({ message: "Server error" })
  }
})

// Get ALL user chats including deleted ones (for user search)
router.get("/all", auth, async (req, res) => {
  try {
    // Build the aggregation pipeline - similar to above but without filtering deleted chats
    const pipeline = [
      {
        $match: {
          "participants.user": req.user._id,
        },
      },
      {
        $addFields: {
          currentUserParticipant: {
            $arrayElemAt: [
              {
                $filter: {
                  input: "$participants",
                  cond: { $eq: ["$$this.user", req.user._id] },
                },
              },
              0,
            ],
          },
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "participants.user",
          foreignField: "_id",
          as: "participantUsers",
        },
      },
      {
        $lookup: {
          from: "messages",
          localField: "lastMessage",
          foreignField: "_id",
          as: "lastMessageData",
        },
      },
      {
        $addFields: {
          participants: {
            $map: {
              input: "$participants",
              as: "participant",
              in: {
                $mergeObjects: [
                  "$$participant",
                  {
                    user: {
                      $arrayElemAt: [
                        {
                          $filter: {
                            input: "$participantUsers",
                            cond: { $eq: ["$$this._id", "$$participant.user"] },
                          },
                        },
                        0,
                      ],
                    },
                  },
                ],
              },
            },
          },
          lastMessage: { $arrayElemAt: ["$lastMessageData", 0] },
        },
      },
      {
        $project: {
          participantUsers: 0,
          lastMessageData: 0,
        },
      },
      {
        $sort: {
          "currentUserParticipant.isPinned": -1,
          updatedAt: -1,
        },
      },
    ]

    const chats = await Chat.aggregate(pipeline)
    res.json(chats)
  } catch (error) {
    console.error("Get all chats error:", error)
    res.status(500).json({ message: "Server error" })
  }
})

// Update chat settings (pin, archive, delete)
router.patch("/:chatId/settings", auth, async (req, res) => {
  try {
    const { chatId } = req.params
    const { isPinned, isArchived, isDeleted } = req.body

    const chat = await Chat.findOne({
      _id: chatId,
      "participants.user": req.user._id,
    })

    if (!chat) {
      return res.status(404).json({ message: "Chat not found" })
    }

    // Find the current user's participant entry
    const participantIndex = chat.participants.findIndex((p) => p.user.toString() === req.user._id.toString())

    if (participantIndex === -1) {
      return res.status(404).json({ message: "User not found in chat" })
    }

    // Update the participant's settings
    if (isPinned !== undefined) {
      chat.participants[participantIndex].isPinned = isPinned
    }
    if (isArchived !== undefined) {
      chat.participants[participantIndex].isArchived = isArchived
      // If archiving, unpin the chat
      if (isArchived) {
        chat.participants[participantIndex].isPinned = false
      }
    }
    if (isDeleted !== undefined) {
      chat.participants[participantIndex].isDeleted = isDeleted
    }

    await chat.save()
    await chat.populate("participants.user", "username email isOnline")

    res.json({ message: "Chat settings updated", chat })
  } catch (error) {
    console.error("Update chat settings error:", error)
    res.status(500).json({ message: "Server error" })
  }
})

// Get chat messages
router.get("/:chatId/messages", auth, async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query

    // Verify user is participant and chat is not deleted
    const chat = await Chat.findOne({
      _id: req.params.chatId,
      "participants.user": req.user._id,
    })

    if (!chat) {
      return res.status(404).json({ message: "Chat not found" })
    }

    // Check if user has deleted this chat
    const userParticipant = chat.participants.find((p) => p.user.toString() === req.user._id.toString())
    if (userParticipant?.isDeleted) {
      return res.status(404).json({ message: "Chat not found" })
    }

    const messages = await Message.find({ chat: req.params.chatId })
      .populate("sender", "username email")
      .populate("sharedNote", "title content owner labels color updatedAt")
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)

    res.json(messages.reverse())
  } catch (error) {
    console.error("Get messages error:", error)
    res.status(500).json({ message: "Server error" })
  }
})

// Create group chat
router.post(
  "/group",
  [auth, body("name").notEmpty().trim().escape(), body("participants").isArray({ min: 1 })],
  async (req, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() })
      }

      const { name, participants } = req.body

      const chat = new Chat({
        name,
        isGroup: true,
        participants: [
          { user: req.user._id, role: "admin" },
          ...participants.map((userId) => ({ user: userId, role: "member" })),
        ],
      })

      await chat.save()
      await chat.populate("participants.user", "username email")

      res.status(201).json(chat)
    } catch (error) {
      console.error("Create group chat error:", error)
      res.status(500).json({ message: "Server error" })
    }
  },
)

module.exports = router
