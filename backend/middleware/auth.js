const jwt = require("jsonwebtoken")
const User = require("../models/User")

// Use default JWT secret if not provided
const JWT_SECRET = process.env.JWT_SECRET || "collaborative-notes-super-secret-jwt-key-2024"

const auth = async (req, res, next) => {
  try {
    const token = req.header("Authorization")?.replace("Bearer ", "") || req.cookies.token

    if (!token) {
      return res.status(401).json({ message: "No token, authorization denied" })
    }

    const decoded = jwt.verify(token, JWT_SECRET)
    const user = await User.findById(decoded.userId).select("-password")

    if (!user) {
      return res.status(401).json({ message: "Token is not valid" })
    }

    req.user = user
    next()
  } catch (error) {
    console.error("Auth middleware error:", error)
    res.status(401).json({ message: "Token is not valid" })
  }
}

module.exports = auth
