import type { Config } from "tailwindcss";

/**
 * USA Peptide Depot theme.
 *
 * The brand kit supplies forest #1F4233, cream #FDFBF0 and navy #233049, and
 * sets them the way the kit does: cream pages, forest type and buttons, navy as
 * the second colour.
 *
 * The `brand.*` tokens are CSS variables (see globals.css), so one class swaps a
 * whole region: pages default to cream, and `.theme-forest` / `.theme-navy`
 * turn the header, hero and footer into light-on-dark without touching the
 * components inside them.
 */

/** A brand token that reads a CSS variable and still accepts `/60` opacity. */
const v = (name: string) => `rgb(var(--brand-${name}) / <alpha-value>)`;

// Semantic error red remains red; it is no longer used as a brand colour.
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

// Navy ramp anchored on the brand-kit navy (#233049).
const blue = {
  50:  '#f1f4f8',
  100: '#dfe5ef',
  200: '#c3cddd',
  300: '#9bacc5',
  400: '#7289aa',
  500: '#536c93',
  600: '#3f5578',
  700: '#324561',
  800: '#293a52',
  900: '#233049',
  950: '#151d2d',
};

// Cream-led neutrals anchored on the brand-kit cream (#FDFBF0).
const neutral = {
  50:  '#fdfbf0',
  100: '#f8f5e8',
  200: '#ece8d8',
  300: '#d6d1c2',
  400: '#a9a99f',
  500: '#7c817b',
  600: '#5e6661',
  700: '#414b46',
  800: '#2a3530',
  900: '#17211d',
  950: '#0c1310',
};

// Forest ramp anchored on the brand-kit forest (#1F4233).
const forest = {
  50:  '#f3f7f4',
  100: '#ddeae2',
  200: '#bcd4c5',
  300: '#90b79f',
  400: '#5f9476',
  500: '#3e745b',
  600: '#2f5c48',
  700: '#274b3b',
  800: '#1f4233',
  900: '#183428',
  950: '#0d1f18',
};

const cream = {
  DEFAULT: '#fdfbf0',
  100: '#f6f2e2',
  200: '#ece8d8',
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
          // Legacy aliases retained for existing class names.
          red: forest[600],
          blue: blue[900],
          white: neutral[50],
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
        // Fixed brand colours, for the few places that must not follow the theme.
        forest: { ...forest, DEFAULT: forest[800] },
        navy: { ...blue, DEFAULT: blue[900] },
        cream,
        brand: {
          dark: v('dark'),
          darker: v('darker'),
          card: v('card'),
          cardHover: v('card-hover'),
          border: v('border'),
          borderLight: v('border-light'),
          accent: v('accent'),
          accentHover: v('accent-hover'),
          // Text on an `accent` fill.
          onAccent: v('on-accent'),
          accentGlow: v('highlight'),
          success: v('success'),
          textMuted: v('muted'),
          heading: v('heading'),
          body: v('body'),
          cyan: blue[300],
          emerald: neutral[100],
          gold: neutral[200],
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
        emerald: forest,
        teal: forest,
        green: forest,
        purple: neutral,
        violet: neutral,
        fuchsia: neutral,
        gray: neutral,
        slate: neutral,
        zinc: neutral,
        stone: neutral,
      },
      fontFamily: {
        sans: ['Cera Pro', 'Manrope', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Helvetica', 'Arial', 'sans-serif'],
        display: ['Cera Pro', 'Archivo', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Helvetica', 'Arial', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      fontSize: {
        // Reference site runs a 14px base with a compact scale.
        'hero': ['clamp(1.875rem, 6vw, 4.5rem)', { lineHeight: '1.02', letterSpacing: '-0.015em', fontWeight: '800' }],
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
