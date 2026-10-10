import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The client talks to the API under /api. In dev we proxy that to the
// Express server so the browser only ever sees one origin.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: process.env.API_URL ?? "http://localhost:4000",
        changeOrigin: true,
      },
    },
  },
});
