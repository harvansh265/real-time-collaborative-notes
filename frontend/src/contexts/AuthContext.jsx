"use client"

import { createContext, useContext, useState, useEffect } from "react"
import axios from "axios"
import toast from "react-hot-toast"

const AuthContext = createContext()

// Configure axios defaults
axios.defaults.baseURL = "http://localhost:5000"
axios.defaults.withCredentials = true

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [token, setToken] = useState(localStorage.getItem("token"))

  // Set axios authorization header
  useEffect(() => {
    if (token) {
      axios.defaults.headers.common["Authorization"] = `Bearer ${token}`
    } else {
      delete axios.defaults.headers.common["Authorization"]
    }
  }, [token])

  // Check if user is authenticated on app load
  useEffect(() => {
    const checkAuth = async () => {
      try {
        if (token) {
          const response = await axios.get("/api/auth/me")
          setUser(response.data.user)
        }
      } catch (error) {
        console.error("Auth check failed:", error)
        localStorage.removeItem("token")
        setToken(null)
      } finally {
        setLoading(false)
      }
    }

    checkAuth()
  }, [token])

  const login = async (email, password) => {
    try {
      const response = await axios.post("/api/auth/login", { email, password })
      const { user, token } = response.data

      setUser(user)
      setToken(token)
      localStorage.setItem("token", token)

      toast.success("Login successful!")
      return { success: true }
    } catch (error) {
      const message = error.response?.data?.message || "Login failed"
      toast.error(message)
      return { success: false, message }
    }
  }

  const register = async (username, email, password) => {
    try {
      const response = await axios.post("/api/auth/register", {
        username,
        email,
        password,
      })
      const { user, token } = response.data

      setUser(user)
      setToken(token)
      localStorage.setItem("token", token)

      toast.success("Registration successful!")
      return { success: true }
    } catch (error) {
      const message = error.response?.data?.message || "Registration failed"
      toast.error(message)
      return { success: false, message }
    }
  }

  const logout = async () => {
    try {
      await axios.post("/api/auth/logout")
    } catch (error) {
      console.error("Logout error:", error)
    } finally {
      setUser(null)
      setToken(null)
      localStorage.removeItem("token")
      toast.success("Logged out successfully")
    }
  }

  const value = {
    user,
    token,
    loading,
    login,
    register,
    logout,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
