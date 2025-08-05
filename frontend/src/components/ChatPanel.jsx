"use client"

import { useState, useEffect, useRef } from "react"
import {
  Send,
  Plus,
  Search,
  MoreVertical,
  Users,
  MessageCircle,
  Bell,
  Check,
  X,
  FileText,
  ExternalLink,
  Pin,
  Archive,
  Trash2,
  ArchiveRestore,
} from "lucide-react"
import { useSocket } from "../contexts/SocketContext"
import { useAuth } from "../contexts/AuthContext"
import { formatDistanceToNow } from "date-fns"
import axios from "axios"
import toast from "react-hot-toast"

export default function ChatPanel({ chats, messages, activeChat, onChatSelect, onSendMessage, loading, refetchChats }) {
  const [messageInput, setMessageInput] = useState("")
  const [showNewChat, setShowNewChat] = useState(false)
  const [showRequests, setShowRequests] = useState(false)
  const [showArchived, setShowArchived] = useState(false)
  const [searchUsers, setSearchUsers] = useState("")
  const [searchChats, setSearchChats] = useState("")
  const [foundUsers, setFoundUsers] = useState([])
  const [searchingUsers, setSearchingUsers] = useState(false)
  const [sendingRequest, setSendingRequest] = useState(null)
  const [chatRequests, setChatRequests] = useState([])
  const [loadingRequests, setLoadingRequests] = useState(false)
  const [respondingToRequest, setRespondingToRequest] = useState(null)
  const [showNoteModal, setShowNoteModal] = useState(false)
  const [selectedNote, setSelectedNote] = useState(null)
  const [showChatMenu, setShowChatMenu] = useState(null)
  const [archivedChats, setArchivedChats] = useState([])
  const [allChats, setAllChats] = useState([]) // Store all chats including deleted ones
  const messagesEndRef = useRef(null)
  const { startTyping, stopTyping, typingUsers, socket } = useSocket()
  const { user } = useAuth()

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Fetch all chats including deleted ones for user search
  const fetchAllChats = async () => {
    try {
      const response = await axios.get("/api/chat/all")
      console.log("Fetched all chats:", response.data)
      setAllChats(response.data)
    } catch (error) {
      console.error("Failed to fetch all chats:", error)
    }
  }

  useEffect(() => {
    fetchAllChats()
  }, [chats]) // Refetch when chats change

  // Fetch chat requests on component mount
  useEffect(() => {
    fetchChatRequests()
  }, [])

  // Fetch archived chats when needed
  useEffect(() => {
    if (showArchived) {
      fetchArchivedChats()
    }
  }, [showArchived])

  // Listen for socket events
  useEffect(() => {
    if (socket) {
      socket.on("new_chat_request", (data) => {
        console.log("New chat request received:", data)
        toast.success(`New chat request from ${data.from.username}`)
        fetchChatRequests() // Refresh requests
      })

      // Handle real-time chat creation - this will be handled in useChat hook
      socket.on("chat_created", (newChat) => {
        console.log("New chat created via socket:", newChat)
        toast.success("New chat created!")

        // Refresh the chat list to include the new chat
        refetchChats()

        // Join the new chat room
        socket.emit("join_chats")
      })

      return () => {
        socket.off("new_chat_request")
        socket.off("chat_created")
      }
    }
  }, [socket, refetchChats])

  const fetchChatRequests = async () => {
    try {
      setLoadingRequests(true)
      const response = await axios.get("/api/chat/requests")
      console.log("Chat requests:", response.data)
      setChatRequests(response.data)
    } catch (error) {
      console.error("Failed to fetch chat requests:", error)
    } finally {
      setLoadingRequests(false)
    }
  }

  const fetchArchivedChats = async () => {
    try {
      const response = await axios.get("/api/chat?includeArchived=true")
      const archived = response.data.filter((chat) => {
        const userParticipant = chat.participants?.find((p) => p.user._id === user?.id || p.user._id === user?._id)
        return userParticipant?.isArchived
      })
      setArchivedChats(archived)
    } catch (error) {
      console.error("Failed to fetch archived chats:", error)
      toast.error("Failed to load archived chats")
    }
  }

  // Update the handleChatAction function
  const handleChatAction = async (chatId, action, value = true) => {
    try {
      const updates = {}
      updates[action] = value

      await axios.patch(`/api/chat/${chatId}/settings`, updates)

      // If deleting the currently active chat, close it
      if (action === "isDeleted" && value && activeChat?._id === chatId) {
        onChatSelect(null) // Close the active chat
      }

      // Refresh chats
      refetchChats()
      if (showArchived) {
        fetchArchivedChats()
      }

      // Also refresh all chats to update the search
      fetchAllChats()

      const actionMessages = {
        isPinned: value ? "Chat pinned" : "Chat unpinned",
        isArchived: value ? "Chat archived" : "Chat unarchived",
        isDeleted: "Chat deleted",
      }

      toast.success(actionMessages[action])
      setShowChatMenu(null)
    } catch (error) {
      console.error(`Failed to ${action} chat:`, error)
      toast.error(`Failed to ${action.replace("is", "").toLowerCase()} chat`)
    }
  }

  const handleChatRequestResponse = async (requestId, status) => {
    try {
      setRespondingToRequest(requestId)
      const response = await axios.patch(`/api/chat/request/${requestId}`, { status })

      if (status === "accepted") {
        toast.success("Chat request accepted!")
        // The new chat will be added via socket event and refetchChats
      } else {
        toast.success("Chat request rejected")
      }

      // Remove the request from the list
      setChatRequests((prev) => prev.filter((req) => req._id !== requestId))
    } catch (error) {
      console.error("Failed to respond to chat request:", error)
      toast.error("Failed to respond to chat request")
    } finally {
      setRespondingToRequest(null)
    }
  }

  // Check if user already has a chat with someone (including deleted chats)
  const hasExistingChat = (userId) => {
    return allChats.some((chat) => {
      if (chat.isGroup) return false
      return chat.participants?.some((p) => p.user._id === userId)
    })
  }

  const getChatDisplayName = (chat) => {
    if (chat.isGroup) {
      return chat.name || "Group Chat"
    }

    // For direct messages, show the other participant's name
    const otherParticipant = chat.participants?.find((p) => p.user._id !== user?.id && p.user._id !== user?._id)
    return otherParticipant?.user.username || "Direct Message"
  }

  // Get user's chat settings
  const getUserChatSettings = (chat) => {
    const userParticipant = chat.participants?.find((p) => p.user._id === user?.id || p.user._id === user?._id)
    return {
      isPinned: userParticipant?.isPinned || false,
      isArchived: userParticipant?.isArchived || false,
      isDeleted: userParticipant?.isDeleted || false,
    }
  }

  // Filter chats based on search - FIXED
  const filteredChats = (showArchived ? archivedChats : chats).filter((chat) => {
    // First filter out deleted chats
    const chatSettings = getUserChatSettings(chat)
    if (chatSettings.isDeleted) return false

    // If no search query, show all non-deleted chats
    if (!searchChats.trim()) return true

    const searchTerm = searchChats.toLowerCase()

    // Get chat display name
    const chatName = getChatDisplayName(chat).toLowerCase()

    // Search in chat name
    if (chatName.includes(searchTerm)) return true

    // Search in last message content (with null check)
    if (chat.lastMessage?.content?.toLowerCase().includes(searchTerm)) return true

    // Search in participant names and emails (with proper null checks)
    const participantMatch = chat.participants?.some((participant) => {
      const participantUser = participant?.user
      if (!participantUser) return false

      // Skip current user in search
      if (participantUser._id === user?.id || participantUser._id === user?._id) return false

      const username = participantUser.username?.toLowerCase() || ""
      const email = participantUser.email?.toLowerCase() || ""

      return username.includes(searchTerm) || email.includes(searchTerm)
    })

    return participantMatch
  })

  // Debug logging
  console.log("Search query:", searchChats)
  console.log("Total chats:", chats.length)
  console.log("Filtered chats:", filteredChats.length)
  console.log("Show archived:", showArchived)

  // Search users function - Updated to show all users
  const handleUserSearch = async (query) => {
    setSearchUsers(query)
    if (query.length < 2) {
      setFoundUsers([])
      return
    }

    try {
      setSearchingUsers(true)
      const response = await axios.get(`/api/auth/users/search?q=${encodeURIComponent(query)}`)
      console.log("Found users:", response.data)

      // Show all users, don't filter out existing chats
      setFoundUsers(response.data)
    } catch (error) {
      console.error("User search error:", error)
      setFoundUsers([])
      toast.error("Failed to search users")
    } finally {
      setSearchingUsers(false)
    }
  }

  const handleSendMessage = (e) => {
    e.preventDefault()
    if (messageInput.trim() && activeChat) {
      onSendMessage(activeChat._id, messageInput.trim())
      setMessageInput("")
      stopTyping(activeChat._id)
    }
  }

  const handleInputChange = (e) => {
    setMessageInput(e.target.value)
    if (activeChat) {
      if (e.target.value.trim()) {
        startTyping(activeChat._id)
      } else {
        stopTyping(activeChat._id)
      }
    }
  }

  const handleNewChatClick = () => {
    console.log("New chat clicked")
    setShowNewChat(!showNewChat)
    setShowRequests(false)
    setShowArchived(false)
    setSearchUsers("")
    setFoundUsers([])
  }

  const handleRequestsClick = () => {
    setShowRequests(!showRequests)
    setShowNewChat(false)
    setShowArchived(false)
    if (!showRequests) {
      fetchChatRequests()
    }
  }

  const handleArchivedClick = () => {
    setShowArchived(!showArchived)
    setShowNewChat(false)
    setShowRequests(false)
    setSearchChats("")
  }

  const handleStartChat = async (selectedUser) => {
    try {
      console.log("Starting chat with:", selectedUser)
      setSendingRequest(selectedUser._id)

      // Check if there's an existing chat (including deleted ones) in allChats
      const existingChat = allChats.find(
        (chat) => !chat.isGroup && chat.participants?.some((p) => p.user._id === selectedUser._id),
      )

      if (existingChat) {
        const chatSettings = getUserChatSettings(existingChat)
        console.log("Found existing chat:", existingChat._id, "Settings:", chatSettings)

        if (chatSettings.isDeleted) {
          // Restore the deleted chat
          console.log("Restoring deleted chat with user:", selectedUser.username)

          try {
            await axios.patch(`/api/chat/${existingChat._id}/settings`, {
              isDeleted: false,
              isArchived: false, // Also unarchive if it was archived
            })

            // Refresh chats and get the updated list
            const updatedChats = await refetchChats()

            // Also refresh all chats to update the search results
            await fetchAllChats()

            // Find the restored chat in the updated list
            const restoredChat = updatedChats.find(
              (chat) =>
                chat._id === existingChat._id ||
                (!chat.isGroup && chat.participants?.some((p) => p.user._id === selectedUser._id)),
            )

            if (restoredChat) {
              onChatSelect(restoredChat)
              toast.success(`Chat with ${selectedUser.username} restored and opened`)
            } else {
              toast.error("Failed to find restored chat")
            }

            setShowNewChat(false)
            setSearchUsers("")
            setFoundUsers([])

            return
          } catch (restoreError) {
            console.error("Failed to restore chat:", restoreError)
            toast.error("Failed to restore chat")
            return
          }
        } else {
          // Chat exists and is not deleted, just open it
          console.log("Opening existing active chat with user:", selectedUser.username)

          // Find the chat in the current chats list (not deleted)
          const activeChat = chats.find(
            (chat) => !chat.isGroup && chat.participants?.some((p) => p.user._id === selectedUser._id),
          )

          if (activeChat) {
            onChatSelect(activeChat)
            toast.success(`Opened chat with ${selectedUser.username}`)
          } else {
            toast.error("Chat exists but couldn't be opened")
          }

          setShowNewChat(false)
          setSearchUsers("")
          setFoundUsers([])
          return
        }
      }

      // No existing chat found, send chat request
      console.log("No existing chat found, sending request to:", selectedUser.username)

      const response = await axios.post("/api/chat/request", {
        to: selectedUser._id,
        message: `Hi! I'd like to start chatting with you.`,
      })

      console.log("Chat request response:", response.data)

      toast.success(`Chat request sent to ${selectedUser.username}`)
      setShowNewChat(false)
      setSearchUsers("")
      setFoundUsers([])
    } catch (error) {
      console.error("Failed to start chat:", error)
      const errorMessage = error.response?.data?.message || "Failed to start chat"

      toast.error(errorMessage)
    } finally {
      setSendingRequest(null)
    }
  }

  const isMyMessage = (message) => {
    return message.sender._id === user?.id || message.sender._id === user?._id
  }

  const handleNoteClick = async (noteId) => {
    try {
      console.log("Fetching note:", noteId)

      // Show loading state
      setSelectedNote({ loading: true })
      setShowNoteModal(true)

      const response = await axios.get(`/api/notes/${noteId}`)
      const note = response.data
      console.log("Note fetched successfully:", note)

      setSelectedNote(note)
    } catch (error) {
      console.error("Failed to fetch note:", error)

      // Close modal on error
      setShowNoteModal(false)
      setSelectedNote(null)

      // Show specific error message
      if (error.response?.status === 404) {
        toast.error("Note not found or you don't have access to this note")
      } else if (error.response?.status === 400) {
        toast.error("Invalid note ID")
      } else {
        toast.error("Failed to open note. Please try again.")
      }
    }
  }

  const renderMessage = (message) => {
    const isNote = message.messageType === "note"

    return (
      <div key={message._id} className={`flex ${isMyMessage(message) ? "justify-end" : "justify-start"}`}>
        <div
          className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
            isMyMessage(message) ? "bg-blue-500 text-white" : "bg-gray-100 text-gray-900"
          }`}
        >
          {!isMyMessage(message) && (
            <p className={`text-xs font-medium mb-1 ${isMyMessage(message) ? "text-blue-100" : "text-gray-600"}`}>
              {message.sender.username}
            </p>
          )}

          {isNote ? (
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <FileText className="w-4 h-4" />
                <span className="text-sm font-medium">Shared Note</span>
              </div>
              {message.sharedNote ? (
                <div
                  className={`p-2 rounded border cursor-pointer hover:opacity-80 ${
                    isMyMessage(message) ? "bg-blue-400 border-blue-300" : "bg-white border-gray-200"
                  }`}
                  onClick={() => handleNoteClick(message.sharedNote._id || message.sharedNote)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className={`font-medium text-sm ${isMyMessage(message) ? "text-white" : "text-gray-900"}`}>
                        {message.sharedNote.title || "Untitled Note"}
                      </h4>
                      <p
                        className={`text-xs mt-1 line-clamp-2 ${isMyMessage(message) ? "text-blue-100" : "text-gray-600"}`}
                      >
                        {message.sharedNote.content || "No content"}
                      </p>
                    </div>
                    <ExternalLink className="w-3 h-3 ml-2 flex-shrink-0" />
                  </div>
                </div>
              ) : (
                <div
                  className={`p-2 rounded border ${isMyMessage(message) ? "bg-blue-400 border-blue-300" : "bg-white border-gray-200"}`}
                >
                  <p className="text-xs">Note not available</p>
                </div>
              )}
              <p className="text-sm">{message.content}</p>
            </div>
          ) : (
            <p className="text-sm">{message.content}</p>
          )}

          <p className={`text-xs mt-1 ${isMyMessage(message) ? "text-blue-100" : "text-gray-500"}`}>
            {formatDistanceToNow(new Date(message.createdAt), { addSuffix: true })}
          </p>
        </div>
      </div>
    )
  }

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showChatMenu && !event.target.closest(".chat-menu-container")) {
        setShowChatMenu(null)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [showChatMenu])

  return (
    <>
      <div className="flex h-full">
        {/* Chat List */}
        <div className="w-1/3 border-r border-gray-200 flex flex-col">
          {/* Chat List Header */}
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-gray-900">{showArchived ? "Archived Chats" : "Chats"}</h2>
              <div className="flex items-center space-x-2">
                <button
                  onClick={handleArchivedClick}
                  className={`p-2 hover:bg-gray-100 rounded-lg ${showArchived ? "bg-gray-100" : ""}`}
                  title="Archived Chats"
                >
                  <Archive className="w-5 h-5 text-gray-600" />
                </button>
                <button
                  onClick={handleRequestsClick}
                  className="p-2 hover:bg-gray-100 rounded-lg relative"
                  title="Chat Requests"
                >
                  <Bell className="w-5 h-5 text-gray-600" />
                  {chatRequests.length > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                      {chatRequests.length}
                    </span>
                  )}
                </button>
                <button onClick={handleNewChatClick} className="p-2 hover:bg-gray-100 rounded-lg">
                  <Plus className="w-5 h-5 text-gray-600" />
                </button>
              </div>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder={`Search ${showArchived ? "archived " : ""}chats...`}
                className="input pl-10 w-full"
                value={searchChats}
                onChange={(e) => setSearchChats(e.target.value)}
              />
              {searchChats && (
                <button
                  onClick={() => setSearchChats("")}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2"
                >
                  <X className="w-4 h-4 text-gray-400 hover:text-gray-600" />
                </button>
              )}
            </div>
          </div>

          {/* Chat Requests Panel */}
          {showRequests && (
            <div className="p-4 bg-yellow-50 border-b border-yellow-200 max-h-64 overflow-y-auto">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium">Chat Requests</h3>
                <button onClick={() => setShowRequests(false)} className="text-gray-500 hover:text-gray-700">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {loadingRequests ? (
                <div className="text-center py-4">
                  <div className="w-6 h-6 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                </div>
              ) : chatRequests.length === 0 ? (
                <p className="text-sm text-gray-500">No pending requests</p>
              ) : (
                <div className="space-y-2">
                  {chatRequests.map((request) => (
                    <div key={request._id} className="bg-white p-3 rounded border">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <div className="w-6 h-6 bg-gray-200 rounded-full flex items-center justify-center">
                            <span className="text-xs font-medium">{request.from.username.charAt(0).toUpperCase()}</span>
                          </div>
                          <div>
                            <p className="text-sm font-medium">{request.from.username}</p>
                            <p className="text-xs text-gray-500">{request.from.email}</p>
                          </div>
                        </div>
                        <div className="flex space-x-1">
                          <button
                            onClick={() => handleChatRequestResponse(request._id, "accepted")}
                            disabled={respondingToRequest === request._id}
                            className="p-1 bg-green-100 hover:bg-green-200 rounded text-green-600 disabled:opacity-50"
                            title="Accept"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleChatRequestResponse(request._id, "rejected")}
                            disabled={respondingToRequest === request._id}
                            className="p-1 bg-red-100 hover:bg-red-200 rounded text-red-600 disabled:opacity-50"
                            title="Reject"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      {request.message && <p className="text-xs text-gray-600 mt-1">{request.message}</p>}
                      <p className="text-xs text-gray-400 mt-1">
                        {formatDistanceToNow(new Date(request.createdAt), { addSuffix: true })}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* New Chat Modal */}
          {showNewChat && (
            <div className="p-4 bg-blue-50 border-b border-blue-200">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium">Start New Chat</h3>
                <button onClick={() => setShowNewChat(false)} className="text-gray-500 hover:text-gray-700">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="relative">
                <input
                  type="text"
                  value={searchUsers}
                  onChange={(e) => handleUserSearch(e.target.value)}
                  placeholder="Search users by username or email..."
                  className="input w-full mb-2"
                />
                {searchingUsers && (
                  <div className="absolute right-2 top-2">
                    <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                  </div>
                )}
              </div>

              {/* Search Results */}
              {foundUsers.length > 0 && (
                <div className="max-h-32 overflow-y-auto border border-gray-200 rounded bg-white mb-2">
                  {foundUsers.map((user) => {
                    const hasChat = hasExistingChat(user._id)
                    const existingChat = allChats.find(
                      (chat) => !chat.isGroup && chat.participants?.some((p) => p.user._id === user._id),
                    )
                    const isDeleted = existingChat ? getUserChatSettings(existingChat).isDeleted : false

                    return (
                      <div
                        key={user._id}
                        onClick={() => handleStartChat(user)}
                        className={`p-2 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0 ${
                          sendingRequest === user._id ? "opacity-50 cursor-not-allowed" : ""
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <div className="w-6 h-6 bg-gray-200 rounded-full flex items-center justify-center">
                              <span className="text-xs font-medium">{user.username.charAt(0).toUpperCase()}</span>
                            </div>
                            <div>
                              <p className="text-sm font-medium">{user.username}</p>
                              <p className="text-xs text-gray-500">
                                {user.email}
                                {hasChat && (
                                  <span className="ml-2 text-blue-600">
                                    {isDeleted ? "• Deleted chat" : "• Active chat"}
                                  </span>
                                )}
                              </p>
                            </div>
                            {user.isOnline && <div className="w-2 h-2 bg-green-500 rounded-full"></div>}
                          </div>
                          {sendingRequest === user._id && (
                            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {searchUsers.length >= 2 && foundUsers.length === 0 && !searchingUsers && (
                <p className="text-sm text-gray-500 mb-2">No users found</p>
              )}
            </div>
          )}

          {/* Chat List */}
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {filteredChats.length === 0 ? (
              <div className="p-4 text-center text-gray-500">
                <MessageCircle className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                {searchChats ? (
                  <>
                    <p>No chats found</p>
                    <p className="text-xs mt-1">Try a different search term</p>
                  </>
                ) : showArchived ? (
                  <>
                    <p>No archived chats</p>
                    <p className="text-xs mt-1">Archive chats to see them here</p>
                  </>
                ) : (
                  <>
                    <p>No chats yet</p>
                    <p className="text-xs mt-1">Click the + button to start a new chat</p>
                  </>
                )}
              </div>
            ) : (
              filteredChats.map((chat) => {
                const chatSettings = getUserChatSettings(chat)
                // Get other participant for direct messages
                const otherParticipant = !chat.isGroup
                  ? chat.participants?.find((p) => p.user._id !== user?.id && p.user._id !== user?._id)
                  : null
                const isOtherUserOnline = otherParticipant?.user?.isOnline || false

                return (
                  <div
                    key={chat._id}
                    className={`p-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50 relative ${
                      activeChat?._id === chat._id ? "bg-blue-50 border-blue-200" : ""
                    }`}
                  >
                    <div className="flex items-center space-x-3" onClick={() => onChatSelect(chat)}>
                      <div className="relative w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                        {chat.isGroup ? (
                          <Users className="w-5 h-5 text-gray-600" />
                        ) : (
                          <MessageCircle className="w-5 h-5 text-gray-600" />
                        )}
                        {/* Online indicator for direct messages */}
                        {!chat.isGroup && (
                          <div
                            className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-white ${
                              isOtherUserOnline ? "bg-green-500" : "bg-red-400"
                            }`}
                          />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2">
                          <p className="font-medium text-gray-900 truncate">{getChatDisplayName(chat)}</p>
                          {chatSettings.isPinned && <Pin className="w-4 h-4 text-yellow-500 flex-shrink-0" />}
                        </div>
                        {chat.lastMessage && (
                          <p className="text-sm text-gray-500 truncate">{chat.lastMessage.content}</p>
                        )}
                      </div>
                      <div className="flex flex-col items-end space-y-1">
                        <div className="text-xs text-gray-400">
                          {chat.updatedAt && formatDistanceToNow(new Date(chat.updatedAt))}
                        </div>
                      </div>
                    </div>

                    {/* Chat Menu - ALWAYS VISIBLE */}
                    <div className="absolute top-2 right-2 chat-menu-container">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setShowChatMenu(showChatMenu === chat._id ? null : chat._id)
                        }}
                        className="p-1 hover:bg-gray-200 rounded"
                      >
                        <MoreVertical className="w-4 h-4 text-gray-500" />
                      </button>

                      {showChatMenu === chat._id && (
                        <div className="absolute right-0 top-6 bg-white border border-gray-200 rounded-lg shadow-lg z-20 py-1 min-w-[140px]">
                          {showArchived ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleChatAction(chat._id, "isArchived", false)
                              }}
                              className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center space-x-2"
                            >
                              <ArchiveRestore className="w-4 h-4" />
                              <span>Unarchive</span>
                            </button>
                          ) : (
                            <>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleChatAction(chat._id, "isPinned", !chatSettings.isPinned)
                                }}
                                className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center space-x-2"
                              >
                                <Pin className="w-4 h-4" />
                                <span>{chatSettings.isPinned ? "Unpin" : "Pin"}</span>
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleChatAction(chat._id, "isArchived", true)
                                }}
                                className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center space-x-2"
                              >
                                <Archive className="w-4 h-4" />
                                <span>Archive</span>
                              </button>
                            </>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              if (window.confirm("Are you sure you want to delete this chat?")) {
                                handleChatAction(chat._id, "isDeleted", true)
                              }
                            }}
                            className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 text-red-600 flex items-center space-x-2"
                          >
                            <Trash2 className="w-4 h-4" />
                            <span>Delete</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Chat Messages */}
        <div className="flex-1 flex flex-col">
          {activeChat ? (
            <>
              {/* Chat Header */}
              <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="relative w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                    {activeChat.isGroup ? (
                      <Users className="w-4 h-4 text-gray-600" />
                    ) : (
                      <MessageCircle className="w-4 h-4 text-gray-600" />
                    )}
                    {/* Online indicator for direct messages */}
                    {!activeChat.isGroup &&
                      (() => {
                        const otherParticipant = activeChat.participants?.find(
                          (p) => p.user._id !== user?.id && p.user._id !== user?._id,
                        )
                        const isOtherUserOnline = otherParticipant?.user?.isOnline || false
                        return (
                          <div
                            className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-white ${
                              isOtherUserOnline ? "bg-green-500" : "bg-red-500"
                            }`}
                          />
                        )
                      })()}
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900">{getChatDisplayName(activeChat)}</h3>
                    {activeChat.isGroup ? (
                      <p className="text-sm text-gray-500">{activeChat.participants?.length || 0} participants</p>
                    ) : (
                      (() => {
                        const otherParticipant = activeChat.participants?.find(
                          (p) => p.user._id !== user?.id && p.user._id !== user?._id,
                        )
                        const isOtherUserOnline = otherParticipant?.user?.isOnline || false
                        return (
                          <div className="flex items-center space-x-1">
                            <span className={`text-sm ${isOtherUserOnline ? "text-green-600" : "text-red-600"}`}>
                              {isOtherUserOnline ? "Online" : "Offline"}
                            </span>
                          </div>
                        )
                      })()
                    )}
                  </div>
                </div>
                {/* <button className="p-2 hover:bg-gray-100 rounded-lg">
                  <MoreVertical className="w-5 h-5 text-gray-600" />
                </button> */}
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
                {messages.length === 0 ? (
                  <div className="text-center text-gray-500 mt-8">
                    <MessageCircle className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                    <p>No messages yet. Start the conversation!</p>
                  </div>
                ) : (
                  messages.map((message) => renderMessage(message))
                )}

                {/* Typing Indicators */}
                {Object.keys(typingUsers).length > 0 && (
                  <div className="flex justify-start">
                    <div className="bg-gray-100 px-4 py-2 rounded-lg">
                      <p className="text-sm text-gray-600">
                        {Object.values(typingUsers).join(", ")} {Object.keys(typingUsers).length === 1 ? "is" : "are"}{" "}
                        typing...
                      </p>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Message Input */}
              <form onSubmit={handleSendMessage} className="p-4 border-t border-gray-200">
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={messageInput}
                    onChange={handleInputChange}
                    placeholder="Type a message..."
                    className="input flex-1"
                  />
                  <button type="submit" disabled={!messageInput.trim()} className="btn-primary p-2 disabled:opacity-50">
                    <Send className="w-5 h-5" />
                  </button>
                </div>
              </form>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <MessageCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Select a chat to start messaging</h3>
                <p className="text-gray-500">Choose a conversation from the list to view messages</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Note Preview Modal */}
      {showNoteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[80vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Shared Note</h2>
              <button onClick={() => setShowNoteModal(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Note Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {selectedNote?.loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                  <span className="ml-2 text-gray-600">Loading note...</span>
                </div>
              ) : selectedNote ? (
                <>
                  <h1 className="text-2xl font-bold text-gray-900 mb-4">{selectedNote.title}</h1>
                  <div className="prose max-w-none">
                    <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">{selectedNote.content}</p>
                  </div>

                  {/* Labels */}
                  {selectedNote.labels && selectedNote.labels.length > 0 && (
                    <div className="mt-6">
                      <h3 className="text-sm font-medium text-gray-700 mb-2">Labels</h3>
                      <div className="flex flex-wrap gap-2">
                        {selectedNote.labels.map((label, index) => (
                          <span
                            key={index}
                            className="inline-block px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded-full"
                          >
                            {label}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Note Info */}
                  <div className="mt-6 pt-4 border-t border-gray-200 text-sm text-gray-500">
                    <p>Created by: {selectedNote.owner?.username || "Unknown"}</p>
                    <p>Last updated: {formatDistanceToNow(new Date(selectedNote.updatedAt), { addSuffix: true })}</p>
                  </div>
                </>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <p>Failed to load note</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-gray-200 flex justify-end">
              <button onClick={() => setShowNoteModal(false)} className="btn-primary px-4 py-2">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
