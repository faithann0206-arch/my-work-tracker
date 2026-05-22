import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";
 
const __dirname = path.dirname(fileURLToPath(import.meta.url));
 
export default defineConfig({
  base: process.env.BASE_PATH ?? "/",
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
    dedupe: ["react", "react-dom"],
  },
  build: {
    outDir: path.resolve(__dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    port: Number(process.env.PORT ?? 5173),
    host: "0.0.0.0",
  },
  preview: {
    port: Number(process.env.PORT ?? 4173),
    host: "0.0.0.0",
  },
});
 
