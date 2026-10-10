import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const proxy = {
  "/api": {
    target: process.env.API_PROXY_TARGET || "http://127.0.0.1:5000",
    changeOrigin: true,
  },
};
export default defineConfig({
  plugins: [react()],
  server: { allowedHosts: [".ngrok-free.dev"], strictPort: true, proxy },
  preview: { strictPort: true, proxy },
});
