import path from "node:path";

export default {
  plugins: {
    // Explicit path so Tailwind finds its config no matter which directory Vite is launched from.
    tailwindcss: { config: path.resolve(import.meta.dirname, "tailwind.config.js") },
    autoprefixer: {},
  },
};
