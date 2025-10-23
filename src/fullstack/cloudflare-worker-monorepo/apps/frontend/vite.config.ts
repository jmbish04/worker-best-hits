import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    open: true
  },
  define: {
    __WORKER_API_BASE__: JSON.stringify(process.env.WORKER_API_BASE || "https://worker.example.com")
  }
});
