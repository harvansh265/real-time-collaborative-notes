"use client"

import { useState, useEffect } from "react"
import { useAuth } from "../contexts/AuthContext"
import Sidebar from "../components/Sidebar"
import NotesGrid from "../components/NotesGrid"
import ChatPanel from "../components/ChatPanel"
import NoteEditor from "../components/NoteEditor"
import BulkActions from "../components/BulkActions"
import SearchBar from "../components/SearchBar"
import { useNotes } from "../hooks/useNotes"
import { useChat } from "../hooks/useChat"

export default function Dashboard() {
  const { user, logout } = useAuth()
  const [selectedNotes, setSelectedNotes] = useState([])
  const [currentView, setCurrentView] = useState("notes") // 'notes' or 'chat'
  const [editingNote, setEditingNote] = useState(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [filters, setFilters] = useState({
    labels: [],
    archived: false,
    pinned: false,
  })

  const {
    notes,
    loading: notesLoading,
    availableLabels,
    createNote,
    updateNote,
    deleteNote,
    bulkUpdateNotes,
    searchNotes,
  } = useNotes()

  const { chats, messages, activeChat, setActiveChat, sendMessage, loading: chatLoading, refetchChats } = useChat()

  // Search notes when query or filters change
  useEffect(() => {
    searchNotes(searchQuery, filters)
  }, [searchQuery, filters, searchNotes])

  const handleNoteSelect = (noteId) => {
    setSelectedNotes((prev) => (prev.includes(noteId) ? prev.filter((id) => id !== noteId) : [...prev, noteId]))
  }

  const handleSelectAll = () => {
    setSelectedNotes(notes.map((note) => note._id))
  }

  const handleDeselectAll = () => {
    setSelectedNotes([])
  }

  const handleBulkAction = async (action, data) => {
    if (selectedNotes.length === 0) return

    try {
      if (action === "delete") {
        // Handle bulk delete differently
        for (const noteId of selectedNotes) {
          await deleteNote(noteId)
        }
      } else {
        await bulkUpdateNotes(selectedNotes, data)
      }
      setSelectedNotes([])
    } catch (error) {
      console.error("Bulk action failed:", error)
    }
  }

  const handleChatDeleted = async (chatId) => {
    // Implement chat deletion logic here
    console.log("Chat deleted:", chatId)
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <Sidebar
        user={user}
        currentView={currentView}
        onViewChange={setCurrentView}
        onLogout={logout}
        filters={filters}
        onFiltersChange={setFilters}
        availableLabels={availableLabels}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <h1 className="text-2xl font-bold text-gray-900">{currentView === "notes" ? "My Notes" : "Chat"}</h1>
              {currentView === "notes" && (
                <SearchBar value={searchQuery} onChange={setSearchQuery} placeholder="Search notes..." />
              )}
            </div>

            {currentView === "notes" && (
              <div className="flex items-center space-x-3">
                {selectedNotes.length > 0 && (
                  <BulkActions
                    selectedCount={selectedNotes.length}
                    onSelectAll={handleSelectAll}
                    onDeselectAll={handleDeselectAll}
                    onBulkAction={handleBulkAction}
                  />
                )}
                <button
                  onClick={() => {
                    console.log("New Note clicked")
                    setEditingNote({})
                  }}
                  className="btn-primary px-4 py-2"
                >
                  New Note
                </button>
              </div>
            )}
          </div>

          {/* Active Filters Display */}
          {currentView === "notes" &&
            (filters.archived || filters.pinned || (filters.labels && filters.labels.length > 0)) && (
              <div className="mt-3 flex items-center space-x-2">
                <span className="text-sm text-gray-600">Active filters:</span>
                {filters.archived && (
                  <span className="inline-flex items-center px-2 py-1 text-xs bg-gray-100 text-gray-800 rounded-full">
                    Archived
                  </span>
                )}
                {filters.pinned && (
                  <span className="inline-flex items-center px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded-full">
                    Pinned
                  </span>
                )}
                {filters.labels &&
                  filters.labels.map((label) => (
                    <span
                      key={label}
                      className="inline-flex items-center px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full"
                    >
                      {label}
                    </span>
                  ))}
                <button
                  onClick={() => setFilters({ labels: [], archived: false, pinned: false })}
                  className="text-xs text-blue-600 hover:text-blue-800 ml-2"
                >
                  Clear all filters
                </button>
              </div>
            )}
        </header>

        {/* Content Area */}
        <main className="flex-1 overflow-hidden">
          {currentView === "notes" ? (
            <div className="h-full flex">
              <div className="flex-1 overflow-auto">
                <NotesGrid
                  notes={notes}
                  loading={notesLoading}
                  selectedNotes={selectedNotes}
                  onNoteSelect={handleNoteSelect}
                  onNoteEdit={setEditingNote}
                  onNoteDelete={deleteNote}
                />
              </div>

              {editingNote && (
                <div className="w-1/2 border-l border-gray-200">
                  <NoteEditor
                    note={editingNote}
                    onSave={editingNote._id ? updateNote : createNote}
                    onClose={() => setEditingNote(null)}
                  />
                </div>
              )}
            </div>
          ) : (
            <ChatPanel
              chats={chats}
              messages={messages}
              activeChat={activeChat}
              onChatSelect={(chat) => setActiveChat(chat)} // Allow null to close chat
              onSendMessage={sendMessage}
              loading={chatLoading}
              refetchChats={refetchChats}
              onChatDeleted={handleChatDeleted}
            />
          )}
        </main>
      </div>
    </div>
  )
}
