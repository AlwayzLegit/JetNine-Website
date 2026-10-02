import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: "var(--ink)",
          2: "var(--ink-2)",
        },
        surface: {
          DEFAULT: "var(--surface)",
          2: "var(--surface-2)",
        },
        line: {
          DEFAULT: "var(--line)",
          2: "var(--line-2)",
          faint: "var(--line-faint)",
        },
        bone: {
          DEFAULT: "var(--bone)",
          2: "var(--bone-2)",
        },
        steel: {
          DEFAULT: "var(--steel)",
          dim: "var(--steel-dim)",
        },
        clearance: {
          DEFAULT: "var(--clearance)",
          hover: "var(--clearance-hover)",
        },
        gold: "var(--gold)",
        success: "var(--success)",
        danger: "var(--danger)",
      },
      fontFamily: {
        serif: ["var(--font-fraunces)", "Fraunces", "Times New Roman", "serif"],
        sans: [
          "var(--font-instrument-sans)",
          "Instrument Sans",
          "system-ui",
          "-apple-system",
          "sans-serif",
        ],
      },
      borderRadius: {
        card: "var(--radius-card)",
        control: "var(--radius-control)",
        pill: "var(--radius-pill)",
      },
      height: {
        header: "var(--header-h)",
      },
      spacing: {
        header: "var(--header-h)",
      },
      maxWidth: {
        container: "1200px",
      },
      transitionTimingFunction: {
        "out-quint": "cubic-bezier(0.16, 1, 0.3, 1)",
        "in-quint": "cubic-bezier(0.4, 0, 1, 1)",
      },
    },
  },
  plugins: [],
};

export default config;
