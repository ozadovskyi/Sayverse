/**
 * Renders a review contact-sheet — the icon large, small, adaptive and
 * monochrome — to /tmp/icon-sheet.png. Composed as a single SVG and
 * rasterised with @resvg/resvg-js; no browser.
 */
import { writeFileSync } from 'node:fs';

import { Resvg } from '@resvg/resvg-js';

import { iconSvg } from './generate-icon.mjs';

const PAD = 52;
const GAP = 44;
const SHEET_BG = '#1c1c22';

/** [label, box size, iconSvg opts, tile background]. */
const tiles = [
  ['master 300', 300, { background: true }, '#000000'],
  ['72px', 72, { background: true }, '#000000'],
  ['48px', 48, { background: true }, '#000000'],
  ['android adaptive', 280, { background: false, scale: 0.62 }, '#0a0a0f'],
  ['themed (mono)', 280, { mono: true, scale: 0.62 }, '#3a4a6a'],
];

/**
 * Embed one icon as a positioned nested `<svg>`. The ids are namespaced so
 * the five icons sharing one document do not collide on `bg` / `glow` / the
 * gradient ids.
 */
function embed(opts, x, box, pfx) {
  return iconSvg(opts)
    .replace(/id="([\w-]+)"/g, `id="${pfx}-$1"`)
    .replace(/url\(#([\w-]+)\)/g, `url(#${pfx}-$1)`)
    .replace(
      /<svg[^>]*>/,
      `<svg x="${x}" y="${PAD}" width="${box}" height="${box}" viewBox="0 0 1024 1024">`,
    );
}

const maxBox = Math.max(...tiles.map(t => t[1]));
const width =
  PAD * 2 + tiles.reduce((s, t) => s + t[1], 0) + GAP * (tiles.length - 1);
const height = PAD * 2 + maxBox + 40;

let x = PAD;
let clips = '';
let body = '';
tiles.forEach(([label, box, opts, bg], i) => {
  const pfx = `t${i}`;
  const radius = (box * 0.22).toFixed(1);
  clips += `<clipPath id="${pfx}-clip"><rect x="${x}" y="${PAD}" width="${box}" height="${box}" rx="${radius}"/></clipPath>`;
  body +=
    `<g clip-path="url(#${pfx}-clip)">` +
    `<rect x="${x}" y="${PAD}" width="${box}" height="${box}" fill="${bg}"/>` +
    embed(opts, x, box, pfx) +
    `</g>` +
    `<text x="${x + box / 2}" y="${PAD + box + 30}" text-anchor="middle" ` +
    `font-family="monospace" font-size="20" font-weight="600" fill="#9aaaaa">${label}</text>`;
  x += box + GAP;
});

const sheet = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>${clips}</defs>
  <rect width="${width}" height="${height}" fill="${SHEET_BG}"/>
  ${body}
</svg>`;

const out = '/tmp/icon-sheet.png';
writeFileSync(out, new Resvg(sheet).render().asPng());
console.log('wrote', out, `${width}x${height}`);
