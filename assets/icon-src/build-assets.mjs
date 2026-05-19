/**
 * Builds the full platform icon set into `assets/` from the single SVG source.
 *
 *   icon.png                   1024  iOS + general app icon (with backdrop)
 *   splash-icon.png            1024  splash mark, transparent (bg from app.json)
 *   android-icon-foreground.png 1024 adaptive foreground, mark in safe zone
 *   android-icon-background.png 1024 adaptive background (radial backdrop)
 *   android-icon-monochrome.png 1024 themed-icon white silhouette
 *   favicon.png                  64  web favicon
 *
 * The Android adaptive safe zone is the central ~66%; the mark is scaled to
 * 0.80 so it (and its glow) sits comfortably inside any system mask.
 */
import { renderIcon } from './render-icon.mjs';

const A = new URL('../', import.meta.url).pathname.replace(/\/$/, '');
const ADAPTIVE = 0.8;

const jobs = [
  ['icon.png', 1024, { background: true }],
  ['splash-icon.png', 1024, { background: false }],
  ['android-icon-foreground.png', 1024, { background: false, scale: ADAPTIVE }],
  ['android-icon-background.png', 1024, { bgOnly: true }],
  ['android-icon-monochrome.png', 1024, { mono: true, scale: ADAPTIVE }],
  ['favicon.png', 64, { background: true }],
];

for (const [name, px, opts] of jobs) {
  renderIcon(`${A}/${name}`, px, opts);
  console.log('wrote', `assets/${name}`, `${px}x${px}`);
}
