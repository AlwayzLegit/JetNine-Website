import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: "var(--ink)",
          2: "var(--ink-2)",
          3: "var(--ink-3)",
          4: "var(--ink-4)",
        },
        bone: {
          DEFAULT: "var(--bone)",
          2: "var(--bone-2)",
        },
        steel: "var(--steel)",
        clearance: {
          DEFAULT: "var(--clearance)",
          hover: "var(--clearance-hover)",
        },
        success: "var(--success)",
        warn: "var(--warn)",
        error: "var(--error)",
      },
      fontFamily: {
        serif: ["var(--font-fraunces)", "Fraunces", "Times New Roman", "serif"],
        sans: ["var(--font-inter)", "Inter", "system-ui", "-apple-system", "sans-serif"],
        mono: ["var(--font-jetbrains-mono)", "JetBrains Mono", "ui-monospace", "monospace"],
      },
      maxWidth: {
        container: "1280px",
      },
      transitionTimingFunction: {
        "out-quint": "cubic-bezier(0.16, 1, 0.3, 1)",
        "in-quint": "cubic-bezier(0.4, 0, 1, 1)",
      },
      letterSpacing: {
        kicker: "0.12em",
        "kicker-wide": "0.16em",
      },
    },
  },
  plugins: [],
};

export default config;
