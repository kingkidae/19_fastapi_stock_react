import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // FastAPI sends no CORS headers, so proxy through the dev server
  server: { proxy: { "/samsung": "http://16.179.21.221" } },
});
