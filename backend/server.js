const express = require("express")
const http = require("http")
const socketIo = require("socket.io")
const cors = require("cors")
const helmet = require("helmet")
const rateLimit = require("express-rate-limit")
const cookieParser = require("cookie-parser")
require("dotenv").config()

const connectDB = require("./config/database")
const authRoutes = require("./routes/auth")
const notesRoutes = require("./routes/notes")
const chatRoutes = require("./routes/chat")
const socketAuth = require("./middleware/socketAuth")
const socketHandlers = require("./socket/socketHandlers")

const app = express()
const server = http.createServer(app)

// Use default values if environment variables are not set
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:3000"
const PORT = process.env.PORT || 5000

// Socket.IO setup with CORS
const io = socketIo(server, {
  cors: {
    origin: CLIENT_URL,
    methods: ["GET", "POST"],
    credentials: true,
  },
})

// Connect to MongoDB
connectDB()

// Security middleware
app.use(helmet())
app.use(
  cors({
    origin: CLIENT_URL,
    credentials: true,
  }),
)



// Body parsing middleware
app.use(express.json({ limit: "10mb" }))
app.use(express.urlencoded({ extended: true }))
app.use(cookieParser())

// Routes
app.use("/api/auth", authRoutes)
app.use("/api/notes", notesRoutes)
app.use("/api/chat", chatRoutes)

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({
    status: "OK",
    message: "Collaborative Notes API is running",
    timestamp: new Date().toISOString(),
  })
})

// Socket authentication middleware
io.use(socketAuth)

// Make io accessible to routes
app.set("io", io)

// Socket.IO connection handling
io.on("connection", (socket) => {
  console.log(`User ${socket.userId} connected`)
  socketHandlers(io, socket)
})

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack)
  res.status(500).json({ message: "Something went wrong!" })
})

server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`)
  console.log(`📱 Frontend URL: ${CLIENT_URL}`)
  console.log(`🔗 API Health Check: http://localhost:${PORT}/api/health`)
  console.log(`📊 Environment: ${process.env.NODE_ENV || "development"}`)
})
