const mongoose = require("mongoose")

const chatSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      trim: true,
    },
    isGroup: {
      type: Boolean,
      default: false,
    },
    participants: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        role: {
          type: String,
          enum: ["admin", "member"],
          default: "member",
        },
        joinedAt: {
          type: Date,
          default: Date.now,
        },
        // User-specific chat settings
        isPinned: {
          type: Boolean,
          default: false,
        },
        isArchived: {
          type: Boolean,
          default: false,
        },
        isDeleted: {
          type: Boolean,
          default: false,
        },
      },
    ],
    lastMessage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
    },
    sharedNotes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Note",
      },
    ],
  },
  {
    timestamps: true,
  },
)

const messageSchema = new mongoose.Schema(
  {
    chat: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Chat",
      required: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    content: {
      type: String,
      required: true,
      maxlength: 1000,
    },
    messageType: {
      type: String,
      enum: ["text", "note", "system"],
      default: "text",
    },
    sharedNote: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Note",
    },
    readBy: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        readAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  {
    timestamps: true,
  },
)

const chatRequestSchema = new mongoose.Schema(
  {
    from: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    to: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "accepted", "rejected"],
      default: "pending",
    },
    message: {
      type: String,
      maxlength: 200,
    },
  },
  {
    timestamps: true,
  },
)

module.exports = {
  Chat: mongoose.model("Chat", chatSchema),
  Message: mongoose.model("Message", messageSchema),
  ChatRequest: mongoose.model("ChatRequest", chatRequestSchema),
}
