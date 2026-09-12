import type { Config } from "tailwindcss";

/**
 * Red / white / blue theme.
 *
 * Layout, type scale and section rhythm follow the reference site; the palette
 * is American — a deep navy shell, white headings, Old Glory Red as the single
 * action colour, with a steel blue for links and secondary accents.
 *
 * The legacy `brand.*` tokens are kept so existing markup keeps compiling, and
 * the stock `cyan`/`blue`/`emerald`/`gray` ramps are overridden so utilities
 * already scattered through the pages resolve into this palette.
 */

// Old Glory Red (#b22234) brightened for legibility on navy.
const red = {
  50:  '#fff1f3',
  100: '#ffdde1',
  200: '#ffbcc4',
  300: '#ff8d99',
  400: '#e03046',
  500: '#d7263d',
  600: '#b22234',
  700: '#8c1a28',
  800: '#5e1119',
  900: '#3a0b11',
  950: '#22060a',
};

// Old Glory Blue (#3c3b6e) pushed toward a cleaner steel blue.
const blue = {
  50:  '#eff4ff',
  100: '#dbe6ff',
  200: '#bcd0ff',
  300: '#8fb4ff',
  400: '#5b8def',
  500: '#3b6fd4',
  600: '#2b55ad',
  700: '#213f80',
  800: '#182c58',
  900: '#101d3a',
  950: '#0a1226',
};

// Neutral greys for surfaces, hairlines and body copy - no blue cast, so the
// red accent is the only colour that carries meaning.
const neutral = {
  50:  '#ffffff',
  100: '#f2f3f5',
  200: '#d9dbe0',
  300: '#b9bcc4',
  400: '#7e838e',
  500: '#5f646e',
  600: '#42464f',
  700: '#232833',
  800: '#141820',
  900: '#0d1017',
  950: '#07090f',
};

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        flag: {
          red: '#b22234',
          blue: '#3c3b6e',
          white: '#ffffff',
        },
        /**
         * Action colours, kept deliberately separate from the brand red.
         *
         * Red is the brand; these are the two fills that have actually been
         * tested as converting, so anything a customer must click to buy or to
         * start a conversation uses one of them. Held as tokens rather than
         * inline hex so swapping them for a test is one edit here.
         *
         * `action` is #BF4F0B because it clears AA with white text (4.84:1).
         * The brighter oranges it replaced — #F58220 at 2.59:1, #E05A0C at
         * 3.73:1 — do not, and these buttons carry small uppercase type where
         * that matters most.
         *
         * `whatsapp` is the brand green, which is far too light to carry white
         * text (1.9:1). It takes the near-black `ink` instead, at about 12:1.
         */
        action: {
          DEFAULT: '#BF4F0B',
          hover: '#A34309',
        },
        whatsapp: {
          DEFAULT: '#25D366',
          hover: '#1DB954',
          ink: '#06210F',
        },
        brand: {
          dark: '#07090f',
          darker: '#040509',
          card: '#0d1017',
          cardHover: '#141820',
          border: '#232833',
          borderLight: '#343a47',
          accent: red[500],
          accentGlow: red[400],
          cyan: blue[400],
          emerald: neutral[100],
          gold: red[400],
          textMuted: neutral[400],
          heading: neutral[100],
          body: neutral[300],
        },
        // Repoint the ramps the existing pages already reference.
        red,
        rose: red,
        amber: red,
        orange: red,
        blue,
        cyan: blue,
        sky: blue,
        indigo: blue,
        // Confirmation states read blue rather than green — no green in this palette.
        emerald: blue,
        teal: blue,
        green: blue,
        purple: neutral,
        violet: neutral,
        fuchsia: neutral,
        gray: neutral,
        slate: neutral,
        zinc: neutral,
        stone: neutral,
      },
      fontFamily: {
        sans: ['Manrope', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Helvetica', 'Arial', 'sans-serif'],
        display: ['Archivo', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Helvetica', 'Arial', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      fontSize: {
        // Reference site runs a 14px base with a compact scale.
        'hero': ['clamp(2.25rem, 6vw, 4.5rem)', { lineHeight: '1.02', letterSpacing: '-0.015em', fontWeight: '800' }],
        'section': ['clamp(1.375rem, 2.4vw, 1.625rem)', { lineHeight: '1.18', letterSpacing: '-0.008em', fontWeight: '800' }],
        'eyebrow': ['0.6875rem', { lineHeight: '1', letterSpacing: '0.16em', fontWeight: '700' }],
      },
      borderRadius: {
        // The reference UI is near-square; soften only slightly.
        'xl': '4px',
        '2xl': '6px',
        '3xl': '8px',
      },
      maxWidth: {
        shell: '1280px',
      },
    },
  },
  plugins: [],
};
export default config;
