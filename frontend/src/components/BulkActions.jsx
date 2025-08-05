"use client"

import { useState } from "react"
import { CheckSquare, Square, Pin, Archive, Trash2 } from "lucide-react"

export default function BulkActions({ selectedCount, onSelectAll, onDeselectAll, onBulkAction }) {
  const [showActions, setShowActions] = useState(false)

  const actions = [
    {
      id: "pin",
      label: "Pin",
      icon: Pin,
      action: () => onBulkAction("pin", { pinned: true }),
    },
    {
      id: "unpin",
      label: "Unpin",
      icon: Pin,
      action: () => onBulkAction("unpin", { pinned: false }),
    },
    {
      id: "archive",
      label: "Archive",
      icon: Archive,
      action: () => onBulkAction("archive", { archived: true }),
    },
    {
      id: "unarchive",
      label: "Unarchive",
      icon: Archive,
      action: () => onBulkAction("unarchive", { archived: false }),
    },
    {
      id: "delete",
      label: "Delete",
      icon: Trash2,
      action: () => {
        if (window.confirm(`Are you sure you want to delete ${selectedCount} note(s)?`)) {
          onBulkAction("delete", {})
        }
      },
      className: "text-red-600 hover:bg-red-50",
    },
  ]

  return (
    <div className="flex items-center space-x-2">
      <span className="text-sm text-gray-600">{selectedCount} selected</span>

      <button onClick={onSelectAll} className="p-1 hover:bg-gray-100 rounded" title="Select all">
        <CheckSquare className="w-4 h-4 text-gray-600" />
      </button>

      <button onClick={onDeselectAll} className="p-1 hover:bg-gray-100 rounded" title="Deselect all">
        <Square className="w-4 h-4 text-gray-600" />
      </button>

      <div className="relative">
        <button onClick={() => setShowActions(!showActions)} className="btn-secondary px-3 py-1 text-sm">
          Actions
        </button>

        {showActions && (
          <div className="absolute right-0 top-8 bg-white border border-gray-200 rounded-lg shadow-lg z-10 py-1 min-w-[120px]">
            {actions.map((action) => {
              const Icon = action.icon
              return (
                <button
                  key={action.id}
                  onClick={() => {
                    action.action()
                    setShowActions(false)
                  }}
                  className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center space-x-2 ${
                    action.className || ""
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{action.label}</span>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
