// Responsável por definir configuração de desenvolvimento e build do Vite.
import { defineConfig } from "vite";

export default defineConfig({
  server: {
    host: true,
    allowedHosts: [".ngrok-free.app"],
    port: 5173
  }
});
