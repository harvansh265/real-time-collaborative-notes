"use client"

export default function DebugPanel({ currentView, editingNote, selectedNotes }) {
  if (process.env.NODE_ENV !== "development") return null

  return (
    <div className="fixed bottom-4 right-4 bg-black text-white p-2 rounded text-xs max-w-xs">
      <div>View: {currentView}</div>
      <div>Editing: {editingNote ? "Yes" : "No"}</div>
      <div>Selected: {selectedNotes?.length || 0}</div>
    </div>
  )
}
