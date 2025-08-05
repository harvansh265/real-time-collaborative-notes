const express = require("express")
const { body, validationResult } = require("express-validator")
const Note = require("../models/Note")
const User = require("../models/User")
const auth = require("../middleware/auth")

const router = express.Router()

// Get all notes for user
router.get("/", auth, async (req, res) => {
  try {
    const { page = 1, limit = 20, search, labels, archived, pinned } = req.query

    const query = {
      $or: [{ owner: req.user._id }, { "sharedWith.user": req.user._id }],
    }

    // Apply filters
    if (search) {
      query.$and = query.$and || []
      query.$and.push({
        $or: [{ title: { $regex: search, $options: "i" } }, { content: { $regex: search, $options: "i" } }],
      })
    }

    if (labels) {
      query.labels = { $in: labels.split(",") }
    }

    if (archived !== undefined) {
      query.archived = archived === "true"
    }

    if (pinned !== undefined) {
      query.pinned = pinned === "true"
    }

    console.log("query note list >>>>>" , query ,archived , pinned , labels);

    const notes = await Note.find(query)
      .populate("owner", "username email")
      .populate("sharedWith.user", "username email")
      .sort({ pinned: -1, updatedAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)

    const total = await Note.countDocuments(query)

    res.json({
      notes,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total,
    })
  } catch (error) {
    console.error("Get notes error:", error)
    res.status(500).json({ message: "Server error" })
  }
})

// Get single note (with better access control)
router.get("/:id", auth, async (req, res) => {
  try {
    const note = await Note.findOne({
      _id: req.params.id,
      $or: [{ owner: req.user._id }, { "sharedWith.user": req.user._id }],
    })
      .populate("owner", "username email")
      .populate("sharedWith.user", "username email")

    if (!note) {
      return res.status(404).json({ message: "Note not found or access denied" })
    }

    res.json(note)
  } catch (error) {
    console.error("Get note error:", error)
    if (error.name === "CastError") {
      return res.status(400).json({ message: "Invalid note ID" })
    }
    res.status(500).json({ message: "Server error" })
  }
})

// Create note
router.post(
  "/",
  [auth, body("title").notEmpty().trim().escape(), body("content").notEmpty().trim()],
  async (req, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() })
      }

      const { title, content, labels = [], color = "#ffffff" } = req.body

      const note = new Note({
        title,
        content,
        owner: req.user._id,
        labels,
        color,
      })

      await note.save()
      await note.populate("owner", "username email")

      res.status(201).json(note)
    } catch (error) {
      console.error("Create note error:", error)
      res.status(500).json({ message: "Server error" })
    }
  },
)

// Update note
router.put(
  "/:id",
  [auth, body("title").optional().trim().escape(), body("content").optional().trim()],
  async (req, res) => {
    console.log("update called")
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() })
      }

      const note = await Note.findOne({
        _id: req.params.id,
        $or: [{ owner: req.user._id }, { "sharedWith.user": req.user._id, "sharedWith.permission": "write" }],
      })

      if (!note) {
        return res.status(404).json({ message: "Note not found or no permission" })
      }

      Object.assign(note, req.body)
      await note.save()
      await note.populate("owner", "username email")
      await note.populate("sharedWith.user", "username email")

      res.json(note)
    } catch (error) {
      console.error("Update note error:", error)
      res.status(500).json({ message: "Server error" })
    }
  },
)

// Delete note
router.delete("/:id", auth, async (req, res) => {
  try {
    const note = await Note.findOneAndDelete({
      _id: req.params.id,
      owner: req.user._id,
    })

    if (!note) {
      return res.status(404).json({ message: "Note not found" })
    }

    res.json({ message: "Note deleted successfully" })
  } catch (error) {
    console.error("Delete note error:", error)
    res.status(500).json({ message: "Server error" })
  }
})

// Bulk update notes
router.patch("/bulk", auth, async (req, res) => {
  try {
    const { noteIds, updates } = req.body

    if (!noteIds || !Array.isArray(noteIds) || noteIds.length === 0) {
      return res.status(400).json({ message: "Note IDs are required" })
    }

    // Use bulkWrite for better performance
    const bulkOps = noteIds.map((noteId) => ({
      updateOne: {
        filter: {
          _id: noteId,
          $or: [{ owner: req.user._id }, { "sharedWith.user": req.user._id, "sharedWith.permission": "write" }],
        },
        update: { $set: updates },
      },
    }))

    const result = await Note.bulkWrite(bulkOps)

    res.json({
      message: "Bulk update completed",
      modifiedCount: result.modifiedCount,
      matchedCount: result.matchedCount,
    })
  } catch (error) {
    console.error("Bulk update error:", error)
    res.status(500).json({ message: "Server error" })
  }
})

// Share note
router.post("/:id/share", auth, async (req, res) => {
  try {
    const { userIds, permission = "write" } = req.body

    const note = await Note.findOne({
      _id: req.params.id,
      owner: req.user._id,
    })

    if (!note) {
      return res.status(404).json({ message: "Note not found" })
    }

    // Add users to sharedWith array
    const newShares = userIds.map((userId) => ({
      user: userId,
      permission,
    }))

    note.sharedWith.push(...newShares)
    await note.save()
    await note.populate("sharedWith.user", "username email")

    res.json(note)
  } catch (error) {
    console.error("Share note error:", error)
    res.status(500).json({ message: "Server error" })
  }
})

module.exports = router
