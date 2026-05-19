/**
 * Rasterises an icon SVG to PNG with `@resvg/resvg-js` — a pure-Rust SVG
 * renderer (no browser, no system dependencies).
 *
 * Usage: node render-icon.mjs <out.png> [size] [mode]
 *   mode: full (default) | transparent | mono | adaptive
 */
import { writeFileSync } from 'node:fs';

import { Resvg } from '@resvg/resvg-js';

import { iconSvg } from './generate-icon.mjs';

const MODES = {
  full: { background: true },
  transparent: { background: false },
  mono: { mono: true },
  adaptive: { background: false, scale: 0.62 },
};

/**
 * Rasterise `iconSvg(modeOpts)` to a `px`×`px` PNG. Transparency comes from
 * the SVG itself — a mode that paints no backdrop renders transparent.
 */
export function renderIcon(outPath, px, modeOpts) {
  const resvg = new Resvg(iconSvg(modeOpts), {
    fitTo: { mode: 'width', value: px },
  });
  writeFileSync(outPath, resvg.render().asPng());
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const out = process.argv[2] ?? new URL('./preview.png', import.meta.url).pathname;
  const size = Number(process.argv[3] ?? 1024);
  const mode = process.argv[4] ?? 'full';
  renderIcon(out, size, MODES[mode] ?? MODES.full);
  console.log('wrote', out, `${size}x${size}`, mode);
}
