"use client"

import { createContext, useContext, useEffect, useState } from "react"
import { io } from "socket.io-client"
import { useAuth } from "./AuthContext"
import toast from "react-hot-toast"

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
  const [noteListRefreshTrigger, setNoteListRefreshTrigger] = useState(0)
  const { user, token } = useAuth()

  useEffect(() => {
    if (user && token) {
      console.log("Connecting socket for user:", user.username)

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

      // Handle note sharing notifications
      newSocket.on("note_shared_with_you", ({ noteTitle, sharedBy }) => {
        toast.success(`${sharedBy} shared a note "${noteTitle}" with you`)
        // Trigger note list refresh
        setNoteListRefreshTrigger((prev) => prev + 1)
      })

      // Handle note list refresh requests
      newSocket.on("note_list_refresh", ({ message }) => {
        console.log("Note list refresh requested:", message)
        // Trigger note list refresh
        setNoteListRefreshTrigger((prev) => prev + 1)
      })

      setSocket(newSocket)

      return () => {
        console.log("Cleaning up socket connection")
        newSocket.close()
        setSocket(null)
        setConnected(false)
      }
    } else {
      console.log("No user or token, not connecting socket")
    }
  }, [user, token])

  const joinNote = (noteId) => {
    if (socket) {
      console.log("Joining note:", noteId)
      socket.emit("join_note", noteId)
    }
  }

  const leaveNote = (noteId) => {
    if (socket) {
      console.log("Leaving note:", noteId)
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

  const notifySaved = (noteId) => {
    if (socket) {
      console.log("Notifying note saved:", noteId)
      socket.emit("note_saved", { noteId })
    }
  }

  const value = {
    socket,
    connected,
    typingUsers,
    noteListRefreshTrigger,
    joinNote,
    leaveNote,
    sendMessage,
    startTyping,
    stopTyping,
    updateNote,
    notifySaved,
  }

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>
}
