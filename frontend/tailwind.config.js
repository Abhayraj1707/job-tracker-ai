/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0F1115",
        surface: "#171A21",
        surface2: "#1D212B",
        border: "#262B35",
        muted: "#8B909C",
        text: "#E8E6E1",
        signal: "#7CE38B",
        warn: "#E3B57C",
        cool: "#7CA8E3",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};
