const mongoose = require("mongoose")

const connectDB = async () => {
  try {
    // Use default local MongoDB if no URI is provided
    const mongoURI = process.env.MONGODB_URI || "mongodb://localhost:27017/collaborative-notes"

    const conn = await mongoose.connect(mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    })

    console.log(`MongoDB Connected: ${conn.connection.host}`)
    console.log(`Database: ${conn.connection.name}`)
  } catch (error) {
    console.error("Database connection error:", error)
    console.log("Make sure MongoDB is running on your local machine")
    console.log("You can start MongoDB with: mongod")
    process.exit(1)
  }
}

module.exports = connectDB
