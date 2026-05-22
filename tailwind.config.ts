import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      colors: {
        bg: "rgb(var(--bg) / <alpha-value>)",
        surface: "rgb(var(--surface) / <alpha-value>)",
        "surface-2": "rgb(var(--surface-2) / <alpha-value>)",
        border: "rgb(var(--border) / <alpha-value>)",
        fg: "rgb(var(--fg) / <alpha-value>)",
        muted: "rgb(var(--muted) / <alpha-value>)",
        accent: "rgb(var(--accent) / <alpha-value>)",
        "accent-2": "rgb(var(--accent-2) / <alpha-value>)",
        danger: "rgb(var(--danger) / <alpha-value>)",
        warning: "rgb(var(--warning) / <alpha-value>)",
        success: "rgb(var(--success) / <alpha-value>)",
      },
      boxShadow: {
        glow: "0 0 20px rgb(var(--accent) / 0.35), 0 0 40px rgb(var(--accent) / 0.15)",
        "glow-sm": "0 0 10px rgb(var(--accent) / 0.4)",
        "inner-glow": "inset 0 0 18px rgb(var(--accent) / 0.12)",
      },
      backgroundImage: {
        grid: "linear-gradient(rgb(var(--border) / 0.35) 1px, transparent 1px), linear-gradient(90deg, rgb(var(--border) / 0.35) 1px, transparent 1px)",
        "accent-gradient": "linear-gradient(135deg, rgb(var(--accent)), rgb(var(--accent-2)))",
      },
      backgroundSize: {
        grid: "32px 32px",
      },
      keyframes: {
        "pulse-glow": {
          "0%,100%": { boxShadow: "0 0 16px rgb(var(--accent) / 0.35)" },
          "50%": { boxShadow: "0 0 28px rgb(var(--accent) / 0.65)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
      animation: {
        "pulse-glow": "pulse-glow 3s ease-in-out infinite",
        shimmer: "shimmer 6s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;
