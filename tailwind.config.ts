import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // "Deep Field" — fresh, map-first satellite palette
        root: "#05070a",
        surface: "#0a0e14",
        elevated: "#10151d",
        card: "#141a24",
        cardhover: "#1a212d",
        input: "#0d121a",
        line: "rgba(255,255,255,0.08)",
        line2: "rgba(255,255,255,0.12)",
        accent: {
          DEFAULT: "#31d0aa", // earth teal
          hover: "#4fe0bd",
          muted: "rgba(49,208,170,0.14)",
          subtle: "rgba(49,208,170,0.08)",
        },
        sky: "#5ab0ff",
        txt: {
          primary: "#f2f5f7",
          secondary: "#9aa7b4",
          muted: "#5f6d7a",
          subtle: "#38424d",
        },
        ok: "#34d399",
        warn: "#fbbf24",
        bad: "#f87171",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      boxShadow: {
        panel: "0 10px 40px -12px rgba(0,0,0,0.7)",
        glow: "0 0 50px -14px rgba(49,208,170,0.35)",
      },
      keyframes: {
        ping2: {
          "75%,100%": { transform: "scale(2)", opacity: "0" },
        },
        fadein: {
          from: { opacity: "0", transform: "translateY(6px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        ping2: "ping2 1.6s cubic-bezier(0,0,0.2,1) infinite",
        fadein: "fadein 0.3s cubic-bezier(0.22,1,0.36,1)",
      },
    },
  },
  plugins: [],
};

export default config;
