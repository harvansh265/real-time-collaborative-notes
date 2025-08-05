"use client"

import { useState } from "react"
import { MoreVertical, Pin, Archive, Trash2, Share, Edit, Clock, StickyNote } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import LoadingSpinner from "./LoadingSpinner"
import ShareNoteModal from "./ShareNoteModal"

export default function NotesGrid({ notes, loading, selectedNotes, onNoteSelect, onNoteEdit, onNoteDelete }) {
  const [showMenu, setShowMenu] = useState(null)
  const [shareModalNote, setShareModalNote] = useState(null)

  if (loading) {
    return <LoadingSpinner />
  }

  if (notes.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <StickyNote className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No notes yet</h3>
          <p className="text-gray-500">Create your first note to get started</p>
        </div>
      </div>
    )
  }

  const getNoteColor = (color) => {
    const colorMap = {
      "#ffffff": "note-white",
      "#fff2cc": "note-yellow",
      "#d4edda": "note-green",
      "#cce5ff": "note-blue",
      "#f8d7da": "note-pink",
      "#e2d5f1": "note-purple",
    }
    return colorMap[color] || "note-white"
  }

  const handleNoteClick = (noteId, event) => {
    // Don't select if clicking on checkbox, menu button, or menu items
    if (event.target.type === "checkbox" || event.target.closest("button") || event.target.closest(".note-menu")) {
      return
    }
    onNoteSelect(noteId)
  }

  const handleCheckboxChange = (noteId, event) => {
    event.stopPropagation()
    onNoteSelect(noteId)
  }

  const handleShareNote = (note, event) => {
    event.stopPropagation()
    setShareModalNote(note)
    setShowMenu(null)
  }

  return (
    <>
      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {notes.map((note) => (
            <div
              key={note._id}
              className={`card p-4 cursor-pointer transition-all hover:shadow-md ${
                selectedNotes.includes(note._id) ? "ring-2 ring-primary-500" : ""
              } ${getNoteColor(note.color)}`}
              onClick={(e) => handleNoteClick(note._id, e)}
            >
              {/* Note Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={selectedNotes.includes(note._id)}
                    onChange={(e) => handleCheckboxChange(note._id, e)}
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    onClick={(e) => e.stopPropagation()}
                  />
                  {note.pinned && <Pin className="w-4 h-4 text-yellow-500" />}
                  {note.archived && <Archive className="w-4 h-4 text-gray-500" />}
                </div>

                <div className="relative note-menu">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setShowMenu(showMenu === note._id ? null : note._id)
                    }}
                    className="p-1 hover:bg-gray-100 rounded"
                  >
                    <MoreVertical className="w-4 h-4 text-gray-500" />
                  </button>

                  {showMenu === note._id && (
                    <div className="absolute right-0 top-8 bg-white border border-gray-200 rounded-lg shadow-lg z-10 py-1 min-w-[120px]">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          onNoteEdit(note)
                          setShowMenu(null)
                        }}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center space-x-2"
                      >
                        <Edit className="w-4 h-4" />
                        <span>Edit</span>
                      </button>
                      <button
                        onClick={(e) => handleShareNote(note, e)}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center space-x-2"
                      >
                        <Share className="w-4 h-4" />
                        <span>Share</span>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          onNoteDelete(note._id)
                          setShowMenu(null)
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

              {/* Note Content */}
              <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2">{note.title}</h3>
              <p className="text-gray-600 text-sm mb-3 line-clamp-3">{note.content}</p>

              {/* Labels */}
              {note.labels && note.labels.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-3">
                  {note.labels.slice(0, 3).map((label, index) => (
                    <span key={index} className="inline-block px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded-full">
                      {label}
                    </span>
                  ))}
                  {note.labels.length > 3 && (
                    <span className="inline-block px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded-full">
                      +{note.labels.length - 3}
                    </span>
                  )}
                </div>
              )}

              {/* Note Footer */}
              <div className="flex items-center justify-between text-xs text-gray-500">
                <div className="flex items-center space-x-1">
                  <Clock className="w-3 h-3" />
                  <span>{formatDistanceToNow(new Date(note.updatedAt), { addSuffix: true })}</span>
                </div>
                {note.sharedWith && note.sharedWith.length > 0 && (
                  <div className="flex items-center space-x-1">
                    <Share className="w-3 h-3" />
                    <span>{note.sharedWith.length}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Share Note Modal */}
      <ShareNoteModal note={shareModalNote} isOpen={!!shareModalNote} onClose={() => setShareModalNote(null)} />
    </>
  )
}
