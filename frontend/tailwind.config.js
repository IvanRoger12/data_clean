import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx,js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: { 900: "#0a0b0f", 800: "#0f1117" }
      },
      boxShadow: {
        neon: "0 0 0 1px rgba(59,130,246,0.2), 0 0 20px rgba(168,85,247,0.2)"
      }
    },
  },
  plugins: [],
} satisfies Config;
