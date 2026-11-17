// Runs SHADE inside the IWER-emulated Quest 3 and checks the real WebXR hand path end-to-end.
import { createRequire } from 'module';
const { chromium } = createRequire(import.meta.url)('playwright');
const out = process.argv[2] || '.';
const times = (process.argv[3] || '3,9,14').split(',').map(Number);
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
await p.goto('http://localhost:4173/?record&emulate');
await p.waitForFunction(() => window.__shade && window.__shade.xr !== 'none', null, { timeout: 30000 }).catch(() => {});
console.log('xr input kind:', await p.evaluate(() => window.__shade?.xr));
let t = 0;
for (const target of times) {
  const n = Math.round((target - t) * 30);
  const f0 = await p.evaluate(() => window.__shade.frames);
  await p.evaluate(n => window.__shade.step(n), n);
  await p.waitForFunction(f => window.__shade.frames >= f, f0 + n, { timeout: 600000 });
  t = target;
  const st = await p.evaluate(() => ({ mode: window.__shade.mode, level: window.__shade.level, xr: window.__shade.xr }));
  await p.screenshot({ path: `${out}/emu_t${target}.png` });
  console.log('t', target, JSON.stringify(st));
}
console.log('errors', errs.slice(0, 8));
await b.close();
