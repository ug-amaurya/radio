import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // @audius/sdk expects Node globals in the browser.
  define: { global: "globalThis" },
  optimizeDeps: { esbuildOptions: { define: { global: "globalThis" } } },
  // .env lives at the monorepo root (see .env.example), not in apps/web/.
  envDir: path.resolve(__dirname, "../../"),
  server: {
    port: 5173,
  },
});
