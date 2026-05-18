/**
 * App-icon generator for OpenTranslator.
 *
 * The mark: two comet trails — the app's signature `EdgeTrail` motif — braided
 * into a vertical double-helix. Two counter-running strands (cyan #00fff0,
 * magenta #ff2bd6) stand for the two languages of a translation pair; the
 * weave nods to the twin snakes of Hermes' caduceus — Hermes being the
 * classical patron of translators ("hermeneutics" is named for him). Drawn in
 * the neon palette on the near-black app background.
 *
 * Each strand is a single smooth filled outline (head→tail taper) painted with
 * a vertical gradient — the strand's `y` is monotonic, so the gradient fades
 * colour and opacity exactly along the comet, with no visible segmentation.
 *
 * `iconSvg(opts)` produces every platform asset from one source:
 *   { background } — solid radial backdrop vs. transparent (splash / adaptive)
 *   { scale }      — shrink the mark into the Android adaptive safe zone
 *   { mono }       — flat white silhouette for the Android themed icon
 *   { bgOnly }     — just the radial backdrop (Android adaptive background)
 *
 * `render-icon.mjs` / `build-assets.mjs` rasterise it to PNG via Playwright.
 */

const SIZE = 1024;
const CX = SIZE / 2;
const CY = SIZE / 2;

/** Centreline on a vertical sine helix; `flip` mirrors x and reverses y. */
const helix = (amp, yTop, H, ph0, phSpan, flip) => f => {
  const g = flip ? 1 - f : f;
  const ph = ph0 + g * phSpan;
  return { x: CX + (flip ? -1 : 1) * amp * Math.sin(ph), y: yTop + g * H };
};

/**
 * A smooth tapered comet ribbon along centreline `centre(f)`, f∈[0,1] head→tail.
 * Returns one closed `<path>` outline plus a vertical `<linearGradient>` that
 * fades colour + opacity from head to tail. `mono` → flat white, no gradient.
 */
function ribbon(centre, { headW, tailW, stops, headY, tailY, id, mono }) {
  const N = 96;
  const EPS = 0.0012;
  const halfW = f => (headW * Math.pow(1 - f, 0.8) + tailW) / 2;

  const edge = f => {
    const c = centre(f);
    const p0 = centre(Math.max(0, f - EPS));
    const p1 = centre(Math.min(1, f + EPS));
    const tx = p1.x - p0.x;
    const ty = p1.y - p0.y;
    const len = Math.hypot(tx, ty) || 1;
    return { c, n: { x: -ty / len, y: ty === 0 && tx === 0 ? 0 : tx / len }, w: halfW(f) };
  };

  const outer = [];
  const inner = [];
  for (let i = 0; i <= N; i++) {
    const e = edge(i / N);
    outer.push(`${(e.c.x + e.w * e.n.x).toFixed(1)},${(e.c.y + e.w * e.n.y).toFixed(1)}`);
    inner.push(`${(e.c.x - e.w * e.n.x).toFixed(1)},${(e.c.y - e.w * e.n.y).toFixed(1)}`);
  }
  const d = `M${outer[0]} L${outer.slice(1).join(' L')} L${inner.reverse().join(' L')} Z`;

  const h = centre(0);
  const hr = halfW(0);
  const fill = mono ? '#ffffff' : `url(#${id})`;
  const defs = mono
    ? ''
    : `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="0" y1="${headY}" x2="0" y2="${tailY}">
      <stop offset="0%" stop-color="${stops[0]}" stop-opacity="1"/>
      <stop offset="38%" stop-color="${stops[1]}" stop-opacity="0.92"/>
      <stop offset="100%" stop-color="${stops[2]}" stop-opacity="0.05"/>
    </linearGradient>
    <radialGradient id="${id}-hot" gradientUnits="userSpaceOnUse" cx="${h.x.toFixed(1)}" cy="${h.y.toFixed(1)}" r="${hr.toFixed(1)}">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.95"/>
      <stop offset="55%" stop-color="#ffffff" stop-opacity="0.45"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>`;

  // Round end-cap, filled with the same gradient as the body → seamless. A
  // soft radial highlight gives the comet a hot core with no hard-edged ring.
  const head =
    `<circle cx="${h.x.toFixed(1)}" cy="${h.y.toFixed(1)}" r="${(hr * 1.01).toFixed(1)}" fill="${fill}"/>` +
    (mono
      ? ''
      : `<circle cx="${h.x.toFixed(1)}" cy="${h.y.toFixed(1)}" r="${hr.toFixed(1)}" fill="url(#${id}-hot)"/>`);

  return { defs, markup: `<path d="${d}" fill="${fill}"/>\n      ${head}` };
}

const CYAN = ['#ecfffe', '#00fff0', '#077a73'];
const MAGENTA = ['#ffeafb', '#ff2bd6', '#7c1d6c'];

// Helix geometry, tuned to sit balanced inside the (rounded-square) icon.
const AMP = 208;
const Y_TOP = 212;
const HEIGHT = 600;
const PH0 = -0.30 * Math.PI;
const PH_SPAN = 2.10 * Math.PI;
const Y_BOT = Y_TOP + HEIGHT;

function strands(mono) {
  const base = { headW: 86, tailW: 4 };
  const cyan = ribbon(helix(AMP, Y_TOP, HEIGHT, PH0, PH_SPAN, false), {
    ...base, stops: CYAN, headY: Y_TOP, tailY: Y_BOT, id: 'g-cyan', mono,
  });
  const magenta = ribbon(helix(AMP, Y_TOP, HEIGHT, PH0, PH_SPAN, true), {
    ...base, stops: MAGENTA, headY: Y_BOT, tailY: Y_TOP, id: 'g-mag', mono,
  });
  return [magenta, cyan]; // cyan drawn last → in front
}

export function iconSvg({ background = true, scale = 1, mono = false, bgOnly = false } = {}) {
  if (bgOnly) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">
  <defs>
    <radialGradient id="bg" cx="50%" cy="40%" r="78%">
      <stop offset="0%" stop-color="#16161f"/>
      <stop offset="58%" stop-color="#0c0c12"/>
      <stop offset="100%" stop-color="#060608"/>
    </radialGradient>
  </defs>
  <rect width="${SIZE}" height="${SIZE}" fill="url(#bg)"/>
</svg>`;
  }
  const items = strands(mono);
  const tx = (CX * (1 - scale)).toFixed(2);
  const ty = (CY * (1 - scale)).toFixed(2);
  const open = `<g transform="translate(${tx} ${ty}) scale(${scale})">`;

  const body = mono
    ? `${open}
    ${items.map(m => `<g>\n      ${m.markup}\n    </g>`).join('\n    ')}
  </g>`
    : `${open}
    ${items.map(m => `<g filter="url(#glow)" opacity="0.8">\n      ${m.markup}\n    </g>`).join('\n    ')}
    ${items.map(m => `<g>\n      ${m.markup}\n    </g>`).join('\n    ')}
  </g>`;

  const bgDefs = mono
    ? ''
    : `<radialGradient id="bg" cx="50%" cy="40%" r="78%">
      <stop offset="0%" stop-color="#16161f"/>
      <stop offset="58%" stop-color="#0c0c12"/>
      <stop offset="100%" stop-color="#060608"/>
    </radialGradient>
    <filter id="glow" x="-45%" y="-45%" width="190%" height="190%">
      <feGaussianBlur stdDeviation="15"/>
    </filter>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">
  <defs>
    ${bgDefs}
    ${items.map(m => m.defs).filter(Boolean).join('\n    ')}
  </defs>
  ${background && !mono ? `<rect width="${SIZE}" height="${SIZE}" fill="url(#bg)"/>` : ''}
  ${body}
</svg>`;
}

// When run directly: write the master icon SVG next to this file.
if (import.meta.url === `file://${process.argv[1]}`) {
  const { writeFileSync } = await import('node:fs');
  const out = new URL('./icon.svg', import.meta.url);
  writeFileSync(out, iconSvg({ background: true }));
  console.log('wrote', out.pathname);
}
