/** @type {import('tailwindcss').Config} */
export default {
  // relative: resolve globs against this file, not the directory Vite was launched from.
  content: { relative: true, files: ["./index.html", "./src/**/*.{ts,tsx}"] },
  theme: {
    extend: {
      colors: {
        // Deep aubergine surfaces, lilac accent (Dribbble "My Crowd" dashboard).
        // Backed by CSS variables so the theme can change at runtime (see src/index.css).
        ink: {
          950: "rgb(var(--c-ink-950) / <alpha-value>)",
          900: "rgb(var(--c-ink-900) / <alpha-value>)",
          800: "rgb(var(--c-ink-800) / <alpha-value>)",
          700: "rgb(var(--c-ink-700) / <alpha-value>)",
          600: "rgb(var(--c-ink-600) / <alpha-value>)",
          500: "rgb(var(--c-ink-500) / <alpha-value>)",
        },
        // "lilac" is the theme accent; the name is historical, the color follows the theme.
        lilac: {
          DEFAULT: "rgb(var(--c-accent) / <alpha-value>)",
          300: "rgb(var(--c-accent-300) / <alpha-value>)",
          600: "rgb(var(--c-accent-600) / <alpha-value>)",
        },
        mint: "rgb(var(--c-mint) / <alpha-value>)",
      },
      fontFamily: { sans: ["Roboto", "ui-sans-serif", "system-ui", "sans-serif"] },
      keyframes: { "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } } },
      animation: { "fade-in": "fade-in 0.8s ease-out both" },
      boxShadow: { card: "0 10px 30px -12px rgba(0,0,0,0.6)" },
    },
  },
  plugins: [],
};
