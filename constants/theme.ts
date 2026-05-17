/**
 * Tron / neon design tokens for the JavaScript side — Skia shaders, animated
 * glow colors, StatusBar style, and anything else that needs a raw value
 * rather than a NativeWind class.
 *
 * NativeWind classes (`bg-base`, `text-fg`, `border-neon`, …) are the primary
 * styling path; their values live in `tailwind.config.js`. The two files must
 * be kept in sync — they are deliberately small and rarely change.
 */

export const colors = {
  base: '#0a0a0f', // app background
  surface: '#12121a', // cards
  surfaceInput: '#1a1a2e', // text inputs
  surfacePanel: '#0d1b2a', // translation panel
  surfaceProcessing: '#2d2d44', // processing / disabled state
  fg: '#e0e0e0', // primary text
  fgMuted: '#7f8c9b', // secondary text
  fgFaint: '#4a5568', // de-emphasized text
  neon: '#00fff0', // primary accent (cyan)
  neonMagenta: '#ff00ff', // recording state
  danger: '#ff0055', // errors
} as const;

export type ColorToken = keyof typeof colors;
