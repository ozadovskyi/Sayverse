/** Renders a review contact-sheet: icon large, small, adaptive, monochrome. */
import { chromium } from '@playwright/test';
import { iconSvg } from './generate-icon.mjs';

const tile = (label, box, inner, bg) => `<div style="text-align:center">
  <div style="width:${box}px;height:${box}px;border-radius:${box * 0.22}px;overflow:hidden;background:${bg};display:flex;align-items:center;justify-content:center">${inner}</div>
  <div style="color:#9aa;font:600 20px ui-monospace,monospace;margin-top:12px">${label}</div>
</div>`;

const svg = (opts, px) => iconSvg(opts).replace('<svg ', `<svg width="${px}" height="${px}" `);

const sheet = `<!doctype html><meta charset="utf-8">
<style>html,body{margin:0;background:#1c1c22}svg{display:block}</style>
<div style="display:flex;gap:44px;padding:52px;align-items:flex-start">
  ${tile('master 300', 300, svg({ background: true }, 300), '#000')}
  ${tile('72px', 72, svg({ background: true }, 72), '#000')}
  ${tile('48px', 48, svg({ background: true }, 48), '#000')}
  ${tile('android adaptive', 280, svg({ background: false, scale: 0.62 }, 280), '#0a0a0f')}
  ${tile('themed (mono)', 280, svg({ mono: true, scale: 0.62 }, 280), '#3a4a6a')}
</div>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 420 } });
await page.setContent(sheet);
await page.waitForTimeout(150);
await page.screenshot({ path: '/tmp/icon-sheet.png' });
await browser.close();
console.log('wrote /tmp/icon-sheet.png');
