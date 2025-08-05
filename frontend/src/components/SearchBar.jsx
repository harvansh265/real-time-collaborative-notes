"use client"

import { Search, X } from "lucide-react"

export default function SearchBar({ value, onChange, placeholder = "Search..." }) {
  return (
    <div className="relative">
      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
        <Search className="h-4 w-4 text-gray-400" />
      </div>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="input pl-10 pr-10 w-64"
        placeholder={placeholder}
      />
      {value && (
        <button onClick={() => onChange("")} className="absolute inset-y-0 right-0 pr-3 flex items-center">
          <X className="h-4 w-4 text-gray-400 hover:text-gray-600" />
        </button>
      )}
    </div>
  )
}
