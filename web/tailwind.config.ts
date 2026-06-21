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
        // TrekRiderz Adventure-Modern Hybrid Theme
        primary: {
          50: '#e6f7f5',
          100: '#b3e8df',
          200: '#80d9ca',
          300: '#4dcab4',
          400: '#1abb9e',
          500: '#15a085', // Main brand color
          600: '#118070',
          700: '#0d605a',
          800: '#094045',
          900: '#042030',
        },
        accent: {
          orange: '#FF6B35',
          purple: '#6C63FF',
          yellow: '#FFD93D',
        },
        dark: {
          900: '#0A0E27',
          800: '#1A1F3A',
          700: '#2A2F4A',
          600: '#3A3F5A',
        }
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        display: ['Outfit', 'sans-serif'],
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'adventure-gradient': 'linear-gradient(135deg, #15a085 0%, #1abb9e 50%, #4dcab4 100%)',
      },
    },
  },
  plugins: [],
} satisfies Config;
