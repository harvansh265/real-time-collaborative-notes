const jwt = require("jsonwebtoken")
const User = require("../models/User")

// Use default JWT secret if not provided
const JWT_SECRET = process.env.JWT_SECRET || "collaborative-notes-super-secret-jwt-key-2024"

const socketAuth = async (socket, next) => {
  try {
    const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace("Bearer ", "")

    if (!token) {
      return next(new Error("Authentication error"))
    }

    const decoded = jwt.verify(token, JWT_SECRET)
    const user = await User.findById(decoded.userId).select("-password")

    if (!user) {
      return next(new Error("Authentication error"))
    }

    socket.userId = user._id.toString()
    socket.user = user
    next()
  } catch (error) {
    console.error("Socket auth error:", error)
    next(new Error("Authentication error"))
  }
}

module.exports = socketAuth
