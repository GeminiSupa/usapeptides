import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          dark: '#080d1a',
          darker: '#040711',
          card: '#0f172a',
          cardHover: '#162238',
          border: '#1e293b',
          borderLight: '#334155',
          accent: '#0284c7',
          accentGlow: '#38bdf8',
          cyan: '#06b6d4',
          emerald: '#10b981',
          gold: '#f59e0b',
          textMuted: '#94a3b8',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      }
    },
  },
  plugins: [],
};
export default config;
