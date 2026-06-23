import type { Config } from "tailwindcss";

export default {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        accent: "#ADFF2F",
        dark: {
          900: "#080C14",
          800: "#0D1320",
          700: "#141D30",
          600: "#1C2840",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        display: ["var(--font-bebas)", "Impact", "sans-serif"],
      },
    },
  },
  plugins: [],
} satisfies Config;
