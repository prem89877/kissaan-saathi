import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Kissaan Saathi palette — deep field-green, ripe-wheat sand, marigold accent.
        // Chosen for the subject (fields, harvest, mandi trade), not a generic SaaS kit.
        field: {
          DEFAULT: "#1F4D36", // deep green — primary brand, headers, farmer actions
          dark: "#153826",
          light: "#2E6B4C",
        },
        sand: {
          DEFAULT: "#FBF7EE", // warm off-white background
          dark: "#F0E9D8",
        },
        marigold: {
          DEFAULT: "#E3A008", // accent — CTAs, highlights, "Admin Reviewed" badge
          dark: "#B87F04",
        },
        soil: {
          DEFAULT: "#5B4636", // secondary text / earthy brown
        },
        alert: {
          DEFAULT: "#B3261E",
        },
      },
      fontFamily: {
        display: ["var(--font-fraunces)", "serif"],
        sans: ["var(--font-work-sans)", "sans-serif"],
      },
      borderRadius: {
        card: "10px",
      },
    },
  },
  plugins: [],
};
export default config;
