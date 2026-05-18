/**
 * Tron / neon design tokens for the JavaScript side — Skia shaders, animated
 * glow colors, and anything else that needs a raw value rather than a
 * NativeWind class.
 *
 * NativeWind classes (`bg-base`, `text-fg`, `border-neon`, …) are the primary
 * styling path; their values live in `tailwind.config.js`. Only the tokens
 * actually consumed on the JS side are mirrored here — add one when a Skia
 * shader or a native prop needs its raw value.
 */

export const colors = {
  fgFaint: '#4a5568', // de-emphasized text
  neon: '#00fff0', // primary accent (cyan)
  neonMagenta: '#ff00ff', // recording state
} as const;
