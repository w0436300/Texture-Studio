import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        display: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "sans-serif",
        ],
      },
      colors: {
        ink: {
          DEFAULT: "#0b0b0c",
          muted: "#6b6b70",
          soft: "#a4a4a9",
          line: "#e6e6e8",
          surface: "#f6f6f7",
        },
      },
      boxShadow: {
        soft: "0 1px 2px rgba(0,0,0,0.04), 0 1px 1px rgba(0,0,0,0.03)",
        pop: "0 10px 30px rgba(0,0,0,0.08)",
      },
      borderRadius: {
        pill: "999px",
      },
    },
  },
  plugins: [],
};

export default config;
