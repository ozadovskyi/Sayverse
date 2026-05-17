/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./App.tsx', './components/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      // Tron / neon palette — the app's single (dark-only) design identity.
      // Ported from the legacy `neonTron` theme; refined during the Phase B
      // redesign. This config is the source of truth for design tokens.
      colors: {
        base: '#0a0a0f', // app background
        surface: {
          DEFAULT: '#12121a', // cards
          input: '#1a1a2e', // text inputs
          panel: '#0d1b2a', // translation panel
          processing: '#2d2d44', // processing/disabled state
        },
        fg: {
          DEFAULT: '#e0e0e0', // primary text
          muted: '#7f8c9b', // secondary text
          faint: '#4a5568', // de-emphasized text
        },
        neon: {
          DEFAULT: '#00fff0', // primary accent (cyan)
          magenta: '#ff00ff', // recording state
          danger: '#ff0055', // errors
        },
      },
    },
  },
  plugins: [],
};
