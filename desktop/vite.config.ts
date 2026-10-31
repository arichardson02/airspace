import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

// Only this app's own files; the window talks to the connector through the preload bridge. Left out in
// development, where Vite's hot reload needs inline scripts and a socket.
const contentSecurityPolicy: Plugin = {
  name: "content-security-policy",
  apply: "build",
  transformIndexHtml: () => [
    {
      tag: "meta",
      attrs: {
        "http-equiv": "Content-Security-Policy",
        content:
          "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'",
      },
      injectTo: "head-prepend",
    },
  ],
};

// The window's page: served by Vite in development, and loaded from dist/renderer in the app.
export default defineConfig({
  plugins: [react(), tailwindcss(), contentSecurityPolicy],
  // The app loads the page from files, so asset URLs must be relative.
  base: "./",
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
  },
  build: {
    outDir: "dist/renderer",
    target: "es2022",
  },
  resolve: {
    // The shared ui package must use this app's React and Motion, not copies of its own.
    dedupe: ["react", "react-dom", "framer-motion"],
  },
});
