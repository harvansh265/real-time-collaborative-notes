import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"

export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // This exposes the server to all network interfaces
    port: 3000, // Changed to port 3000
    open: true, // This will automatically open the browser
    proxy: {
      "/api": {
        target: "http://localhost:5000",
        changeOrigin: true,
      },
    },
  },
})
