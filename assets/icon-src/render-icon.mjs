/**
 * Rasterises an icon SVG to PNG via a headless Chromium page.
 *
 * Usage: node render-icon.mjs <out.png> [size] [mode]
 *   mode: full (default) | transparent | mono | adaptive
 */
import { chromium } from 'playwright';
import { iconSvg } from './generate-icon.mjs';

const MODES = {
  full: { background: true },
  transparent: { background: false },
  mono: { mono: true },
  adaptive: { background: false, scale: 0.62 },
};

const out = process.argv[2] ?? new URL('./preview.png', import.meta.url).pathname;
const size = Number(process.argv[3] ?? 1024);
const mode = process.argv[4] ?? 'full';
const opts = MODES[mode] ?? MODES.full;
const transparent = !opts.background && !opts.mono ? true : opts.mono ? true : false;

export async function renderIcon(outPath, px, modeOpts, alpha) {
  const html = `<!doctype html><meta charset="utf-8">
<style>html,body{margin:0;padding:0}svg{display:block}</style>${iconSvg(modeOpts)}`;
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: px, height: px } });
  await page.setContent(html);
  const el = await page.$('svg');
  await el.evaluate((node, s) => {
    node.setAttribute('width', s);
    node.setAttribute('height', s);
  }, px);
  await page.waitForTimeout(80);
  await page.screenshot({
    path: outPath,
    omitBackground: alpha,
    clip: { x: 0, y: 0, width: px, height: px },
  });
  await browser.close();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await renderIcon(out, size, opts, transparent);
  console.log('wrote', out, `${size}x${size}`, mode);
}
