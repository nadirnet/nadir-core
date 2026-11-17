// Quick visual check: step the recorded demo to given times and screenshot.
import { createRequire } from 'module';
const { chromium } = createRequire(import.meta.url)('playwright');
const url = process.argv[2] || 'http://localhost:4173/?record=1';
const out = process.argv[3] || 'shots';
const times = (process.argv[4] || '1,6,12,20,30,45,60,80,95').split(',').map(Number);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = [];
page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.text()); });
page.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
await page.goto(url);
await page.waitForFunction(() => window.__shade, null, { timeout: 20000 });
await page.evaluate(() => document.getElementById('overlay').style.display = 'none');
let t = 0;
for (const target of times) {
  const n = Math.round((target - t) * 30);
  await page.evaluate(n => window.__shade.step(n), n);
  t = target;
  const mode = await page.evaluate(() => window.__shade.mode);
  await page.screenshot({ path: `${out}/t${String(target).padStart(3, '0')}.png` });
  console.log('shot', target, mode);
}
console.log('errors:', errs.slice(0, 10));
await browser.close();
