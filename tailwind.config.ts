import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // Tesla-inspired monochrome palette
        ink: "#0a0a0a",
        carbon: "#141414",
        slate: {
          850: "#1b1b1d",
        },
        tesla: {
          red: "#e31937",
        },
        signal: {
          buy: "#22c55e",
          sell: "#e31937",
          hold: "#8a8a8e",
        },
      },
      fontFamily: {
        sans: [
          "var(--font-inter)",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(255,255,255,0.06), 0 20px 60px -20px rgba(0,0,0,0.8)",
      },
      keyframes: {
        pulseSoft: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.5" },
        },
        fadeUp: {
          from: { opacity: "0.3", transform: "translateY(6px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        pulseSoft: "pulseSoft 2.4s ease-in-out infinite",
        fadeUp: "fadeUp 0.45s ease-out both",
      },
    },
  },
  plugins: [],
};

export default config;
