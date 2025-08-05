const mongoose = require("mongoose")

const noteSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    content: {
      type: String,
      required: true,
      maxlength: 10000,
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    sharedWith: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        permission: {
          type: String,
          enum: ["read", "write"],
          default: "read",
        },
      },
    ],
    labels: [
      {
        type: String,
        trim: true,
      },
    ],
    archived: {
      type: Boolean,
      default: false,
    },
    pinned: {
      type: Boolean,
      default: false,
    },
    color: {
      type: String,
      default: "#ffffff",
    },
  },
  {
    timestamps: true,
  },
)

// Index for better query performance
noteSchema.index({ owner: 1, createdAt: -1 })
noteSchema.index({ "sharedWith.user": 1 })

module.exports = mongoose.model("Note", noteSchema)
