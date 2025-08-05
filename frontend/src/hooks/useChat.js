"use client"

import { useState, useEffect, useCallback } from "react"
import axios from "axios"
import { useSocket } from "../contexts/SocketContext"
import { useAuth } from "../contexts/AuthContext"
import toast from "react-hot-toast"

export const useChat = () => {
  const [chats, setChats] = useState([])
  const [messages, setMessages] = useState([])
  const [activeChat, setActiveChat] = useState(null)
  const [loading, setLoading] = useState(true)
  const { socket } = useSocket()
  const { user } = useAuth()

  const fetchChats = useCallback(async () => {
    try {
      setLoading(true)
      const response = await axios.get("/api/chat")
      console.log("Fetched chats:", response.data)
      setChats(response.data)
      return response.data // Return the fetched chats
    } catch (error) {
      console.error("Fetch chats error:", error)
      toast.error("Failed to fetch chats")
      return []
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchMessages = useCallback(async (chatId) => {
    try {
      const response = await axios.get(`/api/chat/${chatId}/messages`)
      setMessages(response.data)
    } catch (error) {
      console.error("Fetch messages error:", error)
      toast.error("Failed to fetch messages")
    }
  }, [])

  const sendMessage = useCallback(
    (chatId, content, messageType = "text", sharedNote = null) => {
      if (socket && content.trim()) {
        socket.emit("send_message", {
          chatId,
          content: content.trim(),
          messageType,
          sharedNote,
        })
      }
    },
    [socket],
  )

  const handleChatDeleted = useCallback(
    (deletedChatId) => {
      // If the deleted chat is currently active, close it
      if (activeChat && activeChat._id === deletedChatId) {
        setActiveChat(null)
        setMessages([])
      }

      // Remove the chat from the list
      setChats((prev) => prev.filter((chat) => chat._id !== deletedChatId))
    },
    [activeChat],
  )

  // Get user's chat settings
  const getUserChatSettings = useCallback(
    (chat) => {
      const userParticipant = chat.participants?.find((p) => p.user._id === user?.id || p.user._id === user?._id)
      return {
        isPinned: userParticipant?.isPinned || false,
        isArchived: userParticipant?.isArchived || false,
        isDeleted: userParticipant?.isDeleted || false,
      }
    },
    [user],
  )

  // Function to restore a deleted chat when a new message arrives
  const restoreDeletedChat = useCallback(
    async (chatId) => {
      try {
        console.log("Restoring deleted chat:", chatId)

        // Undelete the chat by setting isDeleted to false
        await axios.patch(`/api/chat/${chatId}/settings`, { isDeleted: false })

        // Refresh the chat list to include the restored chat
        await fetchChats()

        console.log("Chat restored successfully")
      } catch (error) {
        console.error("Failed to restore deleted chat:", error)
      }
    },
    [fetchChats],
  )

  // Update user online status in chats
  const updateUserStatusInChats = useCallback((userId, isOnline) => {
    setChats((prevChats) => {
      return prevChats.map((chat) => {
        // Update participants' online status
        const updatedParticipants = chat.participants?.map((participant) => {
          if (participant.user._id === userId) {
            return {
              ...participant,
              user: {
                ...participant.user,
                isOnline,
              },
            }
          }
          return participant
        })

        return {
          ...chat,
          participants: updatedParticipants,
        }
      })
    })

    // Also update active chat if it contains this user
    setActiveChat((prevActiveChat) => {
      if (!prevActiveChat) return null

      const updatedParticipants = prevActiveChat.participants?.map((participant) => {
        if (participant.user._id === userId) {
          return {
            ...participant,
            user: {
              ...participant.user,
              isOnline,
            },
          }
        }
        return participant
      })

      return {
        ...prevActiveChat,
        participants: updatedParticipants,
      }
    })
  }, [])

  // Socket event listeners
  useEffect(() => {
    if (socket) {
      // Handle new messages
      socket.on("new_message", async (message) => {
        console.log("New message received:", message)

        // Check if this message is for a chat that the user has deleted
        const existingChat = chats.find((chat) => chat._id === message.chat)

        if (existingChat) {
          const chatSettings = getUserChatSettings(existingChat)

          // If the chat was deleted by this user, restore it
          if (chatSettings.isDeleted) {
            console.log("Message received for deleted chat, restoring...")
            await restoreDeletedChat(message.chat)
            toast.info("Chat restored due to new message")
            return // fetchChats will be called in restoreDeletedChat, so return here
          }
        } else {
          // Chat doesn't exist in current list, might be deleted - try to restore
          console.log("Message for unknown chat, attempting to restore...")
          await restoreDeletedChat(message.chat)
          return
        }

        // Add message to current messages if it's for the active chat
        if (activeChat && message.chat === activeChat._id) {
          setMessages((prev) => [...prev, message])
        }

        // Update chat's last message and move to top
        setChats((prev) => {
          const updatedChats = prev.map((chat) => {
            if (chat._id === message.chat) {
              return {
                ...chat,
                lastMessage: message,
                updatedAt: message.createdAt,
              }
            }
            return chat
          })

          // Sort chats
          return updatedChats.sort((a, b) => {
            // Sort by pinned first, then by updatedAt
            const aSettings = getUserChatSettings(a)
            const bSettings = getUserChatSettings(b)

            if (aSettings.isPinned && !bSettings.isPinned) return -1
            if (!aSettings.isPinned && bSettings.isPinned) return 1

            return new Date(b.updatedAt) - new Date(a.updatedAt)
          })
        })
      })

      // Handle user status changes
      socket.on("user_status_changed", ({ userId, isOnline, username }) => {
        console.log(`User ${username} is now ${isOnline ? "online" : "offline"}`)
        updateUserStatusInChats(userId, isOnline)
      })

      // Handle chat restoration
      socket.on("chat_restored", (data) => {
        console.log("Chat restored:", data)
        toast.info(data.message)
        fetchChats() // Refresh chat list to show restored chat
      })

      // Handle new chat requests
      socket.on("new_chat_request", (data) => {
        console.log("New chat request received:", data)
        toast.success(`New chat request from ${data.from.username}`)
      })

      // Handle when a chat request is accepted and a new chat is created
      socket.on("chat_created", (newChat) => {
        console.log("New chat created:", newChat)

        setChats((prev) => {
          // Prevent duplicate chats
          const exists = prev.some((chat) => chat._id === newChat._id)
          if (exists) {
            console.log("Chat already exists, not adding duplicate")
            return prev
          }

          console.log("Adding new chat to list")
          return [newChat, ...prev]
        })

        toast.success("New chat created!")
      })

      // Handle chat deletion
      socket.on("chat_deleted", (data) => {
        console.log("Chat deleted:", data.chatId)
        handleChatDeleted(data.chatId)
      })

      return () => {
        socket.off("new_message")
        socket.off("user_status_changed")
        socket.off("chat_restored")
        socket.off("new_chat_request")
        socket.off("chat_created")
        socket.off("chat_deleted")
      }
    }
  }, [
    socket,
    activeChat,
    getUserChatSettings,
    handleChatDeleted,
    chats,
    restoreDeletedChat,
    fetchChats,
    updateUserStatusInChats,
  ])

  const handleChatSelect = useCallback(
    (chat) => {
      setActiveChat(chat)
      setMessages([]) // Clear previous messages
      if (chat) {
        fetchMessages(chat._id)
      }
    },
    [fetchMessages],
  )

  useEffect(() => {
    fetchChats()
  }, [fetchChats])

  return {
    chats,
    messages,
    activeChat,
    loading,
    setActiveChat: handleChatSelect,
    sendMessage,
    refetchChats: fetchChats,
    handleChatDeleted,
  }
}
