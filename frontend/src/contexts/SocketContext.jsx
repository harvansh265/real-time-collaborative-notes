"use client"

import { createContext, useContext, useEffect, useState } from "react"
import { io } from "socket.io-client"
import { useAuth } from "./AuthContext"

const SocketContext = createContext()

export const useSocket = () => {
  const context = useContext(SocketContext)
  if (!context) {
    throw new Error("useSocket must be used within a SocketProvider")
  }
  return context
}

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null)
  const [connected, setConnected] = useState(false)
  const [typingUsers, setTypingUsers] = useState({})
  const { user, token } = useAuth()

  useEffect(() => {
    if (user && token) {
      const newSocket = io("http://localhost:5000", {
        auth: {
          token,
        },
      })

      newSocket.on("connect", () => {
        console.log("Connected to server")
        setConnected(true)
        newSocket.emit("join_chats")
      })

      newSocket.on("disconnect", () => {
        console.log("Disconnected from server")
        setConnected(false)
      })

      newSocket.on("user_typing", ({ userId, username }) => {
        setTypingUsers((prev) => ({
          ...prev,
          [userId]: username,
        }))
      })

      newSocket.on("user_stop_typing", ({ userId }) => {
        setTypingUsers((prev) => {
          const updated = { ...prev }
          delete updated[userId]
          return updated
        })
      })

      setSocket(newSocket)

      return () => {
        newSocket.close()
        setSocket(null)
        setConnected(false)
      }
    }
  }, [user, token])

  const joinNote = (noteId) => {
    if (socket) {
      socket.emit("join_note", noteId)
    }
  }

  const leaveNote = (noteId) => {
    if (socket) {
      socket.emit("leave_note", noteId)
    }
  }

  const sendMessage = (chatId, content, messageType = "text", sharedNote = null) => {
    if (socket) {
      socket.emit("send_message", {
        chatId,
        content,
        messageType,
        sharedNote,
      })
    }
  }

  const startTyping = (chatId) => {
    if (socket) {
      socket.emit("typing_start", { chatId })
    }
  }

  const stopTyping = (chatId) => {
    if (socket) {
      socket.emit("typing_stop", { chatId })
    }
  }

  const updateNote = (noteId, updates) => {
    if (socket) {
      socket.emit("note_update", { noteId, updates })
    }
  }

  const value = {
    socket,
    connected,
    typingUsers,
    joinNote,
    leaveNote,
    sendMessage,
    startTyping,
    stopTyping,
    updateNote,
  }

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>
}
