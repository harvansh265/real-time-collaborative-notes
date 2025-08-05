"use client"

import { useState, useEffect, useCallback } from "react"
import axios from "axios"
import toast from "react-hot-toast"
import { useSocket } from "../contexts/SocketContext"

export const useNotes = () => {
  const [notes, setNotes] = useState([])
  const [loading, setLoading] = useState(true)
  const [availableLabels, setAvailableLabels] = useState([])
  const { noteListRefreshTrigger, socket } = useSocket()

  // Extract unique labels from notes
  const extractLabels = useCallback((notesArray) => {
    const allLabels = notesArray.reduce((labels, note) => {
      if (note.labels && Array.isArray(note.labels)) {
        labels.push(...note.labels)
      }
      return labels
    }, [])

    // Get unique labels and sort them alphabetically
    const uniqueLabels = [...new Set(allLabels)].sort()
    setAvailableLabels(uniqueLabels)
    return uniqueLabels
  }, [])

  const fetchNotes = useCallback(
    async (params = {}) => {
      try {
        setLoading(true)
        const response = await axios.get("/api/notes", { params })
        setNotes(response.data.notes)

        // Extract labels from all notes (not just filtered ones)
        // We need to get all notes to show all available labels
        if (!params.search && !params.labels && !params.archived && !params.pinned) {
          // Only extract labels when fetching all notes (no filters applied)
          extractLabels(response.data.notes)
        }
      } catch (error) {
        console.error("Fetch notes error:", error)
        toast.error("Failed to fetch notes")
      } finally {
        setLoading(false)
      }
    },
    [extractLabels],
  )

  // Fetch all notes to get available labels
  const fetchAllNotesForLabels = useCallback(async () => {
    try {
      const response = await axios.get("/api/notes")
      extractLabels(response.data.notes)
    } catch (error) {
      console.error("Fetch labels error:", error)
    }
  }, [extractLabels])

  const createNote = async (noteData) => {
    try {
      const response = await axios.post("/api/notes", noteData)
      setNotes((prev) => [response.data, ...prev])

      // Update available labels if new labels were added
      if (response.data.labels && response.data.labels.length > 0) {
        fetchAllNotesForLabels()
      }

      toast.success("Note created successfully")
      return response.data
    } catch (error) {
      console.error("Create note error:", error)
      toast.error("Failed to create note")
      throw error
    }
  }

  const updateNote = async (noteData) => {
    try {
      const response = await axios.put(`/api/notes/${noteData._id}`, noteData)
      setNotes((prev) => prev.map((note) => (note._id === noteData._id ? response.data : note)))

      // Update available labels if labels were changed
      fetchAllNotesForLabels()

      // Notify other users that this note was saved
      if (socket) {
        socket.emit("note_saved", { noteId: noteData._id })
      }

      toast.success("Note updated successfully")
      return response.data
    } catch (error) {
      console.error("Update note error:", error)
      toast.error("Failed to update note")
      throw error
    }
  }

  const deleteNote = async (noteId) => {
    try {
      await axios.delete(`/api/notes/${noteId}`)
      setNotes((prev) => prev.filter((note) => note._id !== noteId))

      // Update available labels after deletion
      fetchAllNotesForLabels()

      toast.success("Note deleted successfully")
    } catch (error) {
      console.error("Delete note error:", error)
      toast.error("Failed to delete note")
      throw error
    }
  }

  const bulkUpdateNotes = async (noteIds, updates) => {
    try {
      await axios.patch("/api/notes/bulk", { noteIds, updates })
      // Refresh notes after bulk update
      fetchNotes()

      // Update available labels
      fetchAllNotesForLabels()

      toast.success("Notes updated successfully")
    } catch (error) {
      console.error("Bulk update error:", error)
      toast.error("Failed to update notes")
      throw error
    }
  }

  const searchNotes = useCallback(
    async (query, filters = {}) => {
      const params = {}
      if (query) params.search = query
      if (filters.labels?.length) params.labels = filters.labels.join(",")

      // Only apply filters if they are explicitly true
      if (filters.archived === true) params.archived = true
      if (filters.pinned === true) params.pinned = true

      await fetchNotes(params)
    },
    [fetchNotes],
  )

  // Listen for real-time note updates
  useEffect(() => {
    if (socket) {
      const handleNoteUpdated = ({ noteId, updates, updatedBy }) => {
        console.log(`Note ${noteId} updated by ${updatedBy.username}`)

        // Update the note in the local state
        setNotes((prev) =>
          prev.map((note) => {
            if (note._id === noteId) {
              return { ...note, ...updates, updatedAt: new Date().toISOString() }
            }
            return note
          }),
        )

        // Show a toast notification
        toast.success(`Note updated by ${updatedBy.username}`, {
          duration: 3000,
        })
      }

      socket.on("note_updated", handleNoteUpdated)

      return () => {
        socket.off("note_updated", handleNoteUpdated)
      }
    }
  }, [socket])

  // Refresh notes when noteListRefreshTrigger changes
  useEffect(() => {
    if (noteListRefreshTrigger > 0) {
      console.log("Refreshing notes due to trigger")
      fetchNotes()
    }
  }, [noteListRefreshTrigger, fetchNotes])

  useEffect(() => {
    fetchNotes()
    fetchAllNotesForLabels()
  }, [fetchNotes, fetchAllNotesForLabels])

  return {
    notes,
    loading,
    availableLabels,
    createNote,
    updateNote,
    deleteNote,
    bulkUpdateNotes,
    searchNotes,
    refetch: fetchNotes,
  }
}
