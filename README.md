# Real-Time Collaborative Notes App

A full-stack collaborative notes application built with React, Node.js, Express, MongoDB, and Socket.IO.

## Tech Stack

### Backend
- Node.js & Express.js
- MongoDB with Mongoose
- Socket.IO for real-time features
- JWT for authentication
- bcrypt for password hashing
- Express validation & rate limiting

### Frontend
- React 18 with Vite
- React Router for navigation
- Socket.IO client
- Tailwind CSS for styling
- React Hook Form for form handling
- Axios for API calls

## Installation & Setup

### Prerequisites
- Node.js (v16 or higher)
- MongoDB (local or cloud)
- npm

### Backend Setup

1. Navigate to the backend directory:
\`\`\`bash
cd backend
\`\`\`

2. Install dependencies:
\`\`\`bash
npm install
\`\`\`

3. Create a \`.env\` file based on \`.env.example\`:
\`\`\`bash
cp ../.env.example .env
\`\`\`

4. Update the environment variables in \`.env\`:
\`\`\`env
MONGODB_URI=mongodb://localhost:27017/collaborative-notes
JWT_SECRET=your-super-secret-jwt-key-here
JWT_EXPIRE=7d
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:3000
SOCKET_CORS_ORIGIN=http://localhost:3000
\`\`\`

5. Start the backend server:
\`\`\`bash
npm run dev
\`\`\`

### Frontend Setup

1. Navigate to the frontend directory:
\`\`\`bash
cd frontend
\`\`\`

2. Install dependencies:
\`\`\`bash
npm install
\`\`\`

3. Start the frontend development server:
\`\`\`bash
npm run dev
\`\`\`


## License

This project is licensed under the MIT License.
