"use client"

import { useState } from "react"
import { StickyNote, MessageCircle, Archive, Pin, LogOut, Filter, Tag, X } from "lucide-react"

export default function Sidebar({
  user,
  currentView,
  onViewChange,
  onLogout,
  filters,
  onFiltersChange,
  availableLabels = [],
}) {
  const [showFilters, setShowFilters] = useState(false)

  const menuItems = [
    { id: "notes", label: "Notes", icon: StickyNote },
    { id: "chat", label: "Chat", icon: MessageCircle },
  ]

  const filterOptions = [
    { key: "archived", label: "Archived", icon: Archive },
    { key: "pinned", label: "Pinned", icon: Pin },
  ]

  const handleFilterChange = (key) => {
    onFiltersChange((prev) => {
      const newFilters = { ...prev }
      if (newFilters[key]) {
        // If currently true, remove the filter (set to undefined)
        delete newFilters[key]
      } else {
        // If currently false/undefined, set to true
        newFilters[key] = true
      }
      return newFilters
    })
  }

  const handleLabelToggle = (label) => {
    onFiltersChange((prev) => {
      const currentLabels = prev.labels || []
      const newLabels = currentLabels.includes(label)
        ? currentLabels.filter((l) => l !== label)
        : [...currentLabels, label]

      const newFilters = { ...prev }
      if (newLabels.length > 0) {
        newFilters.labels = newLabels
      } else {
        delete newFilters.labels
      }

      return newFilters
    })
  }

  const clearAllLabelFilters = () => {
    onFiltersChange((prev) => {
      const newFilters = { ...prev }
      delete newFilters.labels
      return newFilters
    })
  }

  const selectedLabels = filters.labels || []

  return (
    <div className="w-64 bg-white border-r border-gray-200 flex flex-col">
      {/* User Profile */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
            <span className="text-primary-600 font-semibold">{user?.username?.charAt(0).toUpperCase()}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{user?.username}</p>
            <p className="text-xs text-gray-500 truncate">{user?.email}</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2">
        {menuItems.map((item) => {
          const Icon = item.icon
          return (
            <button
              key={item.id}
              onClick={() => onViewChange(item.id)}
              className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left transition-colors ${
                currentView === item.id
                  ? "bg-primary-50 text-primary-700 border border-primary-200"
                  : "text-gray-700 hover:bg-gray-50"
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="font-medium">{item.label}</span>
            </button>
          )
        })}

        {/* Filters for Notes */}
        {currentView === "notes" && (
          <div className="pt-4 border-t border-gray-200">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="w-full flex items-center justify-between px-3 py-2 text-gray-700 hover:bg-gray-50 rounded-lg"
            >
              <div className="flex items-center space-x-3">
                <Filter className="w-5 h-5" />
                <span className="font-medium">Filters</span>
              </div>
              {(filters.archived || filters.pinned || selectedLabels.length > 0) && (
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              )}
            </button>

            {showFilters && (
              <div className="mt-2 space-y-3 pl-8">
                {/* Status Filters */}
                <div className="space-y-1">
                  {filterOptions.map((option) => {
                    const Icon = option.icon
                    return (
                      <label key={option.key} className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={filters[option.key]}
                          onChange={() => handleFilterChange(option.key)}
                          className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                        />
                        <Icon className="w-4 h-4 text-gray-500" />
                        <span className="text-sm text-gray-700">{option.label}</span>
                      </label>
                    )
                  })}
                </div>

                {/* Labels Filter */}
                {availableLabels.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Tag className="w-4 h-4 text-gray-500" />
                        <span className="text-sm font-medium text-gray-700">Labels</span>
                      </div>
                      {selectedLabels.length > 0 && (
                        <button onClick={clearAllLabelFilters} className="text-xs text-blue-600 hover:text-blue-800">
                          Clear all
                        </button>
                      )}
                    </div>

                    {/* Selected Labels */}
                    {selectedLabels.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-2">
                        {selectedLabels.map((label) => (
                          <span
                            key={label}
                            className="inline-flex items-center px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full"
                          >
                            {label}
                            <button
                              onClick={() => handleLabelToggle(label)}
                              className="ml-1 text-blue-600 hover:text-blue-800"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Available Labels */}
                    <div className="max-h-32 overflow-y-auto space-y-1">
                      {availableLabels.map((label) => (
                        <label key={label} className="flex items-center space-x-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedLabels.includes(label)}
                            onChange={() => handleLabelToggle(label)}
                            className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                          />
                          <span className="text-sm text-gray-700">{label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {/* No Labels Message */}
                {availableLabels.length === 0 && (
                  <div className="text-xs text-gray-500 italic">
                    No labels found. Add labels to your notes to filter by them.
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </nav>

      {/* Bottom Actions */}
      <div className="p-4 border-t border-gray-200 space-y-2">
        <button
          onClick={onLogout}
          className="w-full flex items-center space-x-3 px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg"
        >
          <LogOut className="w-5 h-5" />
          <span>Logout</span>
        </button>
      </div>
    </div>
  )
}
