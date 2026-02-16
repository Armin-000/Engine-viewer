import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  publicDir: "public",
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    allowedHosts: "all"
  },
  build: {
    outDir: "dist",
    assetsDir: "assets",
    emptyOutDir: true
  }
});
