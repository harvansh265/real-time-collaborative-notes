"use client"

import { useState, useEffect } from "react"
import { X, Users, MessageCircle, Send, Check } from "lucide-react"
import axios from "axios"
import toast from "react-hot-toast"
import { useSocket } from "../contexts/SocketContext"

export default function ShareNoteModal({ note, isOpen, onClose }) {
  const [chats, setChats] = useState([])
  const [selectedChats, setSelectedChats] = useState([])
  const [loading, setLoading] = useState(false)
  const [sharing, setSharing] = useState(false)
  const { sendMessage } = useSocket()

  useEffect(() => {
    if (isOpen) {
      fetchChats()
    }
  }, [isOpen])

  const fetchChats = async () => {
    try {
      setLoading(true)
      const response = await axios.get("/api/chat")
      setChats(response.data)
    } catch (error) {
      console.error("Failed to fetch chats:", error)
      toast.error("Failed to load chats")
    } finally {
      setLoading(false)
    }
  }

  const handleChatToggle = (chatId) => {
    setSelectedChats((prev) => (prev.includes(chatId) ? prev.filter((id) => id !== chatId) : [...prev, chatId]))
  }

  const handleShareNote = async () => {
    if (selectedChats.length === 0) {
      toast.error("Please select at least one chat")
      return
    }

    try {
      setSharing(true)

      // Share note to each selected chat
      for (const chatId of selectedChats) {
        // Send a message with the shared note
        const shareMessage = `📝 Shared a note: "${note.title}"`

        // Use socket to send message with note data
        sendMessage(chatId, shareMessage, "note", note._id)
      }

      toast.success(`Note shared to ${selectedChats.length} chat(s)`)
      setSelectedChats([])
      onClose()
    } catch (error) {
      console.error("Failed to share note:", error)
      toast.error("Failed to share note")
    } finally {
      setSharing(false)
    }
  }

  const getChatDisplayName = (chat) => {
    if (chat.isGroup) {
      return chat.name || "Group Chat"
    }

    // For direct messages, show the other participant's name
    const otherParticipant = chat.participants?.find((p) => p.user._id !== note.owner)
    return otherParticipant?.user.username || "Direct Message"
  }

  const getChatParticipantCount = (chat) => {
    return chat.participants?.length || 0
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Share Note</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Note Preview */}
        <div className="p-4 border-b border-gray-200 bg-gray-50">
          <h3 className="font-medium text-gray-900 mb-1">{note.title}</h3>
          <p className="text-sm text-gray-600 line-clamp-2">{note.content}</p>
        </div>

        {/* Chat List */}
        <div className="flex-1 overflow-y-auto p-4">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Select chats to share with:</h3>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : chats.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <MessageCircle className="w-8 h-8 mx-auto mb-2 text-gray-300" />
              <p>No chats available</p>
              <p className="text-xs mt-1">Start a conversation first</p>
            </div>
          ) : (
            <div className="space-y-2">
              {chats.map((chat) => (
                <div
                  key={chat._id}
                  onClick={() => handleChatToggle(chat._id)}
                  className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedChats.includes(chat._id)
                      ? "bg-blue-50 border-blue-200"
                      : "bg-white border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    {/* Checkbox */}
                    <div
                      className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                        selectedChats.includes(chat._id) ? "bg-blue-500 border-blue-500" : "border-gray-300"
                      }`}
                    >
                      {selectedChats.includes(chat._id) && <Check className="w-3 h-3 text-white" />}
                    </div>

                    {/* Chat Icon */}
                    <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                      {chat.isGroup ? (
                        <Users className="w-5 h-5 text-gray-600" />
                      ) : (
                        <MessageCircle className="w-5 h-5 text-gray-600" />
                      )}
                    </div>

                    {/* Chat Info */}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">{getChatDisplayName(chat)}</p>
                      <p className="text-sm text-gray-500">
                        {chat.isGroup ? `${getChatParticipantCount(chat)} members` : "Direct message"}
                      </p>
                    </div>

                    {/* Online indicator for direct messages */}
                    {!chat.isGroup && chat.participants?.some((p) => p.user.isOnline && p.user._id !== note.owner) && (
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 flex items-center justify-between">
          <p className="text-sm text-gray-600">
            {selectedChats.length > 0
              ? `${selectedChats.length} chat${selectedChats.length > 1 ? "s" : ""} selected`
              : "Select chats to share with"}
          </p>
          <div className="flex space-x-2">
            <button onClick={onClose} className="btn-secondary px-4 py-2">
              Cancel
            </button>
            <button
              onClick={handleShareNote}
              disabled={selectedChats.length === 0 || sharing}
              className="btn-primary px-4 py-2 flex items-center space-x-2 disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              <span>{sharing ? "Sharing..." : "Share"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
