import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#0b0f17",
        panel: "#121826",
        edge: "#1f2937",
        accent: "#34d399",
        warn: "#f59e0b",
      },
    },
  },
  plugins: [],
};

export default config;
