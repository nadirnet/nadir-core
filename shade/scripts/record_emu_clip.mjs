// Captures a clip of SHADE running inside the IWER-emulated Quest 3 (real WebXR hand path).
// Reads the WebGL canvas directly (much faster than page screenshots in XR mode).
// usage: node scripts/record_emu_clip.mjs "http://localhost:4173/?record&emulate" out_dir seconds
import { createRequire } from 'module';
import fs from 'fs';
const { chromium } = createRequire(import.meta.url)('playwright');
const [url = 'http://localhost:4173/?record&emulate', out = 'record_emu', secs = '20'] = process.argv.slice(2);
const FPS = 30, N = Math.round(+secs * FPS);
fs.mkdirSync(`${out}/frames`, { recursive: true });
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
p.on('pageerror', e => console.error('PAGEERROR', e.message));
await p.goto(url);
await p.waitForFunction(() => window.__shade && window.__shade.xr === 'hands', null, { timeout: 60000 });
for (let f = 0; f < N; f++) {
  const f0 = await p.evaluate(() => window.__shade.frames);
  await p.evaluate(() => window.__shade.step(1));
  await p.waitForFunction(x => window.__shade.frames > x, f0, { polling: 5 });
  const data = await p.evaluate(() => window.__shade.snap(0.9));
  fs.writeFileSync(`${out}/frames/f${String(f).padStart(5, '0')}.jpg`, Buffer.from(data.split(',')[1], 'base64'));
  if (f % 90 === 0) console.log('frame', f, await p.evaluate(() => JSON.stringify({ mode: window.__shade.mode, level: window.__shade.level, xr: window.__shade.xr })));
}
const events = await p.evaluate(() => window.__shade.events);
fs.writeFileSync(`${out}/events.json`, JSON.stringify({ fps: FPS, intro: 0, frames: N, events }));
console.log('done', N, 'frames');
await b.close();
