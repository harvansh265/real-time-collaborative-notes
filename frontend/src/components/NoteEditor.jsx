"use client"

import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { X, Save, Pin, Archive, Palette, Tag } from "lucide-react"
import { useSocket } from "../contexts/SocketContext"

const NOTE_COLORS = [
  { name: "White", value: "#ffffff" },
  { name: "Yellow", value: "#fff2cc" },
  { name: "Green", value: "#d4edda" },
  { name: "Blue", value: "#cce5ff" },
  { name: "Pink", value: "#f8d7da" },
  { name: "Purple", value: "#e2d5f1" },
]

export default function NoteEditor({ note, onSave, onClose }) {
  const [showColorPicker, setShowColorPicker] = useState(false)
  const [labels, setLabels] = useState(note?.labels || [])
  const [newLabel, setNewLabel] = useState("")
  const { updateNote, joinNote, leaveNote } = useSocket()

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { isDirty, errors, isSubmitting },
  } = useForm({
    defaultValues: {
      title: note?.title || "",
      content: note?.content || "",
      color: note?.color || "#ffffff",
      pinned: note?.pinned || false,
      archived: note?.archived || false,
    },
  })

  const watchedValues = watch()

  // Join note room for real-time collaboration
  useEffect(() => {
    if (note?._id) {
      joinNote(note._id)
      return () => leaveNote(note._id)
    }
  }, [note?._id, joinNote, leaveNote])

  // Send real-time updates
  useEffect(() => {
    if (note?._id && isDirty) {
      const timeoutId = setTimeout(() => {
        updateNote(note._id, watchedValues)
      }, 500) // Debounce updates

      return () => clearTimeout(timeoutId)
    }
  }, [watchedValues, note?._id, isDirty, updateNote])

  const onSubmit = async (data) => {
    try {
      console.log("Saving note:", data)
      const noteData = {
        ...data,
        labels,
        ...(note?._id && { _id: note._id }),
      }
      await onSave(noteData)
      onClose()
    } catch (error) {
      console.error("Save note error:", error)
    }
  }

  const addLabel = () => {
    if (newLabel.trim() && !labels.includes(newLabel.trim())) {
      setLabels([...labels, newLabel.trim()])
      setNewLabel("")
    }
  }

  const removeLabel = (labelToRemove) => {
    setLabels(labels.filter((label) => label !== labelToRemove))
  }

  return (
    <div className="h-full flex flex-col bg-white max-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 flex-shrink-0">
        <h2 className="text-lg font-semibold text-gray-900">{note?._id ? "Edit Note" : "New Note"}</h2>
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={() => setShowColorPicker(!showColorPicker)}
            className="p-2 hover:bg-gray-100 rounded-lg relative"
          >
            <Palette className="w-5 h-5 text-gray-600" />
            {showColorPicker && (
              <div className="absolute right-0 top-10 bg-white border border-gray-200 rounded-lg shadow-lg p-2 z-10">
                <div className="grid grid-cols-3 gap-2">
                  {NOTE_COLORS.map((color) => (
                    <button
                      key={color.value}
                      type="button"
                      onClick={() => {
                        setValue("color", color.value)
                        setShowColorPicker(false)
                      }}
                      className="w-8 h-8 rounded-full border-2 border-gray-300 hover:border-gray-400"
                      style={{ backgroundColor: color.value }}
                      title={color.name}
                    />
                  ))}
                </div>
              </div>
            )}
          </button>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>
      </div>

      {/* Form Content - Scrollable */}
      <div className="flex-1 overflow-y-auto">
        <form onSubmit={handleSubmit(onSubmit)} className="h-full flex flex-col">
          <div className="p-4 space-y-4 flex-1">
            {/* Title */}
            <div>
              <input
                {...register("title", {
                  required: "Title is required",
                  minLength: { value: 1, message: "Title cannot be empty" },
                })}
                type="text"
                placeholder="Note title..."
                className={`w-full text-xl font-semibold border-none outline-none resize-none bg-transparent ${
                  errors.title ? "border-b-2 border-red-500" : ""
                }`}
              />
              {errors.title && (
                <p className="text-red-500 text-sm mt-1 flex items-center">
                  <span className="mr-1">⚠️</span>
                  {errors.title.message}
                </p>
              )}
            </div>

            {/* Content */}
            <div>
              <textarea
                {...register("content", {
                  required: "Content is required",
                  minLength: { value: 1, message: "Content cannot be empty" },
                })}
                placeholder="Start writing..."
                className={`w-full h-64 border-none outline-none resize-none bg-transparent text-gray-700 leading-relaxed ${
                  errors.content ? "border-2 border-red-500 rounded" : ""
                }`}
              />
              {errors.content && (
                <p className="text-red-500 text-sm mt-1 flex items-center">
                  <span className="mr-1">⚠️</span>
                  {errors.content.message}
                </p>
              )}
            </div>

            {/* Labels */}
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Tag className="w-4 h-4 text-gray-500" />
                <span className="text-sm font-medium text-gray-700">Labels</span>
              </div>

              <div className="flex flex-wrap gap-2">
                {labels.map((label, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded-full"
                  >
                    {label}
                    <button
                      type="button"
                      onClick={() => removeLabel(label)}
                      className="ml-1 text-gray-500 hover:text-gray-700"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), addLabel())}
                  placeholder="Add label..."
                  className="input text-sm"
                />
                <button type="button" onClick={addLabel} className="btn-secondary px-3 py-1 text-sm">
                  Add
                </button>
              </div>
            </div>

            {/* Options */}
            <div className="flex items-center space-x-4">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  {...register("pinned")}
                  type="checkbox"
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <Pin className="w-4 h-4 text-gray-500" />
                <span className="text-sm text-gray-700">Pin note</span>
              </label>

              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  {...register("archived")}
                  type="checkbox"
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <Archive className="w-4 h-4 text-gray-500" />
                <span className="text-sm text-gray-700">Archive</span>
              </label>
            </div>

            {/* General Error Message */}
            {(errors.title || errors.content) && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <div className="flex items-center">
                  <span className="text-red-500 mr-2">⚠️</span>
                  <span className="text-red-700 font-medium">Please fix the errors above before saving</span>
                </div>
              </div>
            )}
          </div>

          {/* Footer - Always visible */}
          <div className="p-4 border-t border-gray-200 flex justify-end space-x-3 bg-white flex-shrink-0">
            <button type="button" onClick={onClose} className="btn-secondary px-4 py-2">
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary px-4 py-2 flex items-center space-x-2 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{isSubmitting ? "Saving..." : "Save Note"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
