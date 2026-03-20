import { defineConfig } from "vite";
import { fileURLToPath, URL } from "node:url";

export default defineConfig(({ mode }) => ({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url))
    }
  },
  assetsInclude: [
    "**/*.glb",
    "**/*.gltf",
    "**/*.bin",
    "**/*.hdr",
    "**/*.env",
    "**/*.ktx2",
    "**/*.mp3",
    "**/*.wav",
    "**/*.ogg"
  ],
  server: {
    host: true,
    port: 5173,
    strictPort: false,
    allowedHosts: mode === "ngrok" ? [".ngrok-free.app"] : true
  },
  preview: {
    host: true,
    port: 4173
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: mode !== "production",
    target: "es2022"
  }
}));
