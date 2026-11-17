// Deterministic demo-video capture: steps the game frame-by-frame at 30fps with the
// puppeteer bot playing, overlays captions, and writes JPEG frames + an event log for audio.
// usage: node scripts/record.mjs http://localhost:4173/?record=1 out_dir
import { createRequire } from 'module';
import fs from 'fs';
const { chromium } = createRequire(import.meta.url)('playwright');

const url = process.argv[2] || 'http://localhost:4173/?record=1';
const out = process.argv[3] || 'record_out';
const FPS = 30, INTRO = 3.5, OUTRO = 6;
const EMU = url.includes('emulate');
fs.mkdirSync(`${out}/frames`, { recursive: true });

const CAPTIONS = {
  'menu-first': 'Your hands are the controller. Hold a shadow over a card to choose.',
  'level-0': "In Kit's world, shadows are solid. Lay a hand flat and become the bridge.",
  'level-1': 'Slide under Kit and raise your hand. You are the elevator.',
  'level-2': 'Ember rain! Shelter Kit with your palm.',
  'level-3': 'Two hands: a wall to turn Kit around, a lift to climb home.',
  'level-4': 'The finale: bridge, shelter and lift, all at once.',
  'harp': 'Shadow Harp: free play. Every finger is a note.',
};

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', e => console.error('PAGEERROR', e.message));
await page.goto(url);
await page.waitForFunction(EMU ? () => window.__shade && window.__shade.xr === 'hands' : () => window.__shade, null, { timeout: 60000 });
const stepOne = async () => {
  if (!EMU) return page.evaluate(() => window.__shade.step(1, 1 / 30));
  const f0 = await page.evaluate(() => window.__shade.frames);
  await page.evaluate(() => window.__shade.step(1));
  await page.waitForFunction(f => window.__shade.frames > f, f0, { timeout: 60000, polling: 10 });
};
await page.evaluate(() => { document.getElementById('overlay').style.display = 'none'; document.getElementById('status').style.display = 'none'; });

let f = 0;
const shot = async () => { await page.screenshot({ path: `${out}/frames/f${String(f).padStart(5, '0')}.jpg`, type: 'jpeg', quality: 88 }); f++; };
const setCaption = (text, op) => page.evaluate(([t, o]) => { const c = document.getElementById('caption'); c.textContent = t; c.style.transition = 'none'; c.style.opacity = o; }, [text, op]);

// intro title card (fade from black)
await page.evaluate(emu => { document.getElementById('titlecard').classList.add('show'); if (emu) document.getElementById('titlesub').innerHTML = 'a hand-shadow puppet theater for Meta Quest<br><small style="opacity:.7">captured in IWER, Meta\'s WebXR emulator: emulated Quest 3 with hand tracking</small>'; }, EMU);
for (let i = 0; i < INTRO * FPS; i++) {
  const a = Math.min(1, i / 20, (INTRO * FPS - i) / 15);
  await page.evaluate(a => { document.getElementById('titlecard').style.opacity = 1; document.querySelector('#titlecard > div').style.opacity = a; }, a);
  await shot();
}
await page.evaluate(() => document.getElementById('titlecard').classList.remove('show'));

let key = null, capT = 0, capText = '', seenMenu = false;
const startF = f;
const MAX = 200 * FPS;
while (f - startF < MAX) {
  await stepOne();
  const st = await page.evaluate(() => ({ mode: window.__shade.mode, level: window.__shade.level, done: window.__shade.done }));
  let k = st.mode === 'level' ? `level-${st.level}` : st.mode === 'harp' ? 'harp' : st.mode === 'menu' && !seenMenu ? 'menu-first' : null;
  if (st.mode === 'menu') seenMenu = true;
  if (k && k !== key && CAPTIONS[k]) { key = k; capT = 0; capText = CAPTIONS[k]; }
  capT += 1 / FPS;
  const op = capText ? Math.max(0, Math.min(1, capT / 0.4, (5.2 - capT) / 0.5)) : 0;
  await setCaption(capText, op.toFixed(3));
  await shot();
  if ((f - startF) % 150 === 0) console.log(`frame ${f} t=${((f - startF) / FPS).toFixed(1)}s mode=${st.mode} level=${st.level}`);
  if (st.done) break;
}
await setCaption('', 0);
// hold 1s of gameplay tail, then end card
for (let i = 0; i < FPS; i++) { await stepOne(); await shot(); }
await page.evaluate(() => {
  const tc = document.getElementById('titlecard'); tc.classList.add('show');
  document.getElementById('titlesub').innerHTML = 'Hands-only &middot; seated &middot; mixed reality<br>WebXR for Meta Quest &mdash; play it in Quest Browser';
});
for (let i = 0; i < OUTRO * FPS; i++) { await page.evaluate(a => { document.querySelector('#titlecard > div').style.opacity = a; }, Math.min(1, i / 20)); await shot(); }

const events = await page.evaluate(() => window.__shade.events);
fs.writeFileSync(`${out}/events.json`, JSON.stringify({ fps: FPS, intro: INTRO, frames: f, events }));
console.log('frames', f, 'duration', (f / FPS).toFixed(1), 's events', events.length);
await browser.close();
