import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Dev: Vite serves the React app on :5173 and proxies API calls to the
// zero-dependency Node server on :4321. Build: outputs static files to dist/,
// which the same Node server serves in production (single port).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:4321",
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
