const express = require("express")
const jwt = require("jsonwebtoken")
const { body, validationResult } = require("express-validator")
const User = require("../models/User")
const { Chat } = require("../models/Chat")
const auth = require("../middleware/auth")

const router = express.Router()

// Use default values if environment variables are not set
const JWT_SECRET = process.env.JWT_SECRET || "collaborative-notes-super-secret-jwt-key-2024"
const JWT_EXPIRE = process.env.JWT_EXPIRE || "7d"

// Generate JWT token
const generateToken = (userId) => {
  return jwt.sign({ userId }, JWT_SECRET, {
    expiresIn: JWT_EXPIRE,
  })
}

// Helper function to broadcast user status changes
const broadcastUserStatusChange = async (io, userId, isOnline, username) => {
  try {
    // Find all chats where this user is a participant
    const userChats = await Chat.find({
      "participants.user": userId,
    }).populate("participants.user", "_id")

    // Get all unique user IDs from these chats (excluding the current user)
    const relevantUserIds = new Set()
    userChats.forEach((chat) => {
      chat.participants.forEach((participant) => {
        if (participant.user._id.toString() !== userId.toString()) {
          relevantUserIds.add(participant.user._id.toString())
        }
      })
    })

    // Broadcast status change to all relevant users
    relevantUserIds.forEach((relevantUserId) => {
      io.to(`user_${relevantUserId}`).emit("user_status_changed", {
        userId: userId.toString(),
        isOnline,
        username,
      })
    })

    console.log(`Broadcasted ${username} is now ${isOnline ? "online" : "offline"} to ${relevantUserIds.size} users`)
  } catch (error) {
    console.error("Error broadcasting user status change:", error)
  }
}

// Register
router.post(
  "/register",
  [
    body("username").isLength({ min: 3 }).trim().escape(),
    body("email").isEmail().normalizeEmail(),
    body("password").isLength({ min: 6 }),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() })
      }

      const { username, email, password } = req.body

      // Check if user exists
      const existingUser = await User.findOne({
        $or: [{ email }, { username }],
      })

      if (existingUser) {
        return res.status(400).json({ message: "User already exists" })
      }

      // Create user
      const user = new User({ username, email, password })
      await user.save()

      // Generate token
      const token = generateToken(user._id)

      // Set HTTP-only cookie
      res.cookie("token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      })

      res.status(201).json({
        message: "User registered successfully",
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
        },
        token,
      })
    } catch (error) {
      console.error("Register error:", error)
      res.status(500).json({ message: "Server error" })
    }
  },
)

// Login
router.post("/login", [body("email").isEmail().normalizeEmail(), body("password").exists()], async (req, res) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() })
    }

    const { email, password } = req.body

    // Find user
    const user = await User.findOne({ email })
    if (!user) {
      return res.status(400).json({ message: "Invalid credentials" })
    }

    // Check password
    const isMatch = await user.comparePassword(password)
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" })
    }

    // Generate token
    const token = generateToken(user._id)

    // Set HTTP-only cookie
    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    })

    res.json({
      message: "Login successful",
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
      },
      token,
    })
  } catch (error) {
    console.error("Login error:", error)
    res.status(500).json({ message: "Server error" })
  }
})

// Logout
router.post("/logout", auth, async (req, res) => {
  try {
    // Update online status
    await User.findByIdAndUpdate(req.user._id, {
      isOnline: false,
      lastSeen: new Date(),
    })

    // Broadcast offline status to other users
    const io = req.app.get("io")
    if (io) {
      await broadcastUserStatusChange(io, req.user._id, false, req.user.username)
    }

    // Clear cookie
    res.clearCookie("token")
    res.json({ message: "Logout successful" })
  } catch (error) {
    console.error("Logout error:", error)
    res.status(500).json({ message: "Server error" })
  }
})

// Get current user
router.get("/me", auth, (req, res) => {
  res.json({
    user: {
      id: req.user._id,
      username: req.user.username,
      email: req.user.email,
      isOnline: req.user.isOnline,
    },
  })
})

// Search users
router.get("/users/search", auth, async (req, res) => {
  try {
    const { q } = req.query
    if (!q || q.length < 2) {
      return res.status(400).json({ message: "Search query too short" })
    }

    const users = await User.find({
      $and: [
        { _id: { $ne: req.user._id } },
        {
          $or: [{ username: { $regex: q, $options: "i" } }, { email: { $regex: q, $options: "i" } }],
        },
      ],
    })
      .select("username email isOnline")
      .limit(10)

    res.json(users)
  } catch (error) {
    console.error("Search users error:", error)
    res.status(500).json({ message: "Server error" })
  }
})

module.exports = router
