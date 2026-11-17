// Renders a 3840x2160 thumbnail from the real game scene (hi-res paper screen) + title overlay.
// usage: node scripts/thumbnail.mjs out.png [scale=2] [t=9.3] [camJSON]
import { createRequire } from 'module';
const { chromium } = createRequire(import.meta.url)('playwright');
const [out = 'thumbnail.png', scale = '2', t = '9.3', camJson] = process.argv.slice(2);
const cam = camJson ? JSON.parse(camJson) : { eye: [0.36, 0.0, 0.92], look: [-0.06, -0.11, 0], fov: 50 };
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: +scale });
await p.goto('http://localhost:4173/?record&hires');
await p.waitForFunction(() => window.__shade, null, { timeout: 60000 });
await p.evaluate(() => { for (const id of ['overlay', 'status', 'caption', 'back', 'keys']) { const e = document.getElementById(id); if (e) e.style.display = 'none'; } });
const n = Math.round(+t * 30);
for (let i = 0; i < n; i += 30) await p.evaluate(k => window.__shade.step(k), Math.min(30, n - i));
await p.evaluate(c => { window.__cam = c; window.__shade.step(1, 1 / 120); }, cam);
await p.evaluate(() => {
  const l = document.createElement('link'); l.rel = 'stylesheet';
  l.href = 'https://fonts.googleapis.com/css2?family=Cinzel:wght@600;800&family=Cormorant+Garamond:ital,wght@1,500;1,600&display=block';
  document.head.appendChild(l);
  const o = document.createElement('div'); o.id = 'thumb';
  o.innerHTML = `
  <style>
    #thumb { position: fixed; inset: 0; pointer-events: none; }
    #thumb .vig { position: absolute; inset: 0; background:
      radial-gradient(ellipse 75% 70% at 52% 46%, rgba(0,0,0,0) 45%, rgba(8,3,6,.55) 80%, rgba(5,2,4,.88) 100%); }
    #thumb .warm { position: absolute; inset: 0; mix-blend-mode: screen; background:
      radial-gradient(ellipse 26% 24% at 66% 88%, rgba(255,170,70,.32), rgba(255,140,40,0) 70%),
      radial-gradient(ellipse 40% 30% at 66% 45%, rgba(255,215,150,.10), rgba(0,0,0,0) 70%); }
    #thumb .bar { position: absolute; left: 0; top: 0; bottom: 0; width: 52%;
      background: linear-gradient(to right, rgba(10,4,7,.93) 0%, rgba(10,4,7,.7) 55%, rgba(10,4,7,0) 100%); }
    #thumb .title { position: absolute; left: 4.6%; top: 50%; transform: translateY(-50%); color: #f6e6c4; }
    #thumb h1 { font: 800 150px/0.9 Cinzel, serif; letter-spacing: .13em; margin: 0;
      text-shadow: 0 0 40px rgba(255,170,80,.55), 0 0 90px rgba(255,140,40,.35), 0 6px 18px rgba(0,0,0,.8); }
    #thumb .tag { font: italic 600 50px Cormorant Garamond, serif; color: #ffd894; margin: 18px 0 0 8px;
      text-shadow: 0 3px 12px rgba(0,0,0,.9); }
    #thumb .kicker { font: 600 21px Cinzel, serif; letter-spacing: .34em; color: #e9a21c; margin: 0 0 18px 10px; text-shadow: 0 2px 10px #000; }
    #thumb .chips { display: flex; gap: 14px; margin: 26px 0 0 8px; }
    #thumb .chip { font: 600 21px Cinzel, serif; letter-spacing: .14em; color: #1d0c08; background: #e9a21c;
      padding: 9px 18px 7px; border-radius: 999px; box-shadow: 0 4px 16px rgba(0,0,0,.6); }
    #thumb .chip.alt { background: rgba(246,230,196,.12); color: #f6e6c4; border: 2px solid rgba(233,162,28,.85); }
    #thumb .corner { position: absolute; left: 5%; bottom: 6%; font: 600 22px Cinzel, serif; letter-spacing: .3em;
      color: rgba(246,230,196,.7); text-shadow: 0 2px 10px #000; line-height: 1.6; }
    #thumb .frame { position: absolute; inset: 22px; border: 2px solid rgba(233,162,28,.35); border-radius: 18px; }
  </style>
  <div class="warm"></div><div class="vig"></div><div class="bar"></div><div class="frame"></div>
  <div class="corner">META QUEST · WEBXR · NO CONTROLLERS</div>
  <div class="title"><div class="kicker">A HAND-SHADOW PUPPET THEATER</div><h1>SHADE</h1>
    <div class="tag">Your hands cast the level.</div>
    <div class="chips"><span class="chip">HAND TRACKING</span><span class="chip alt">MIXED REALITY</span><span class="chip alt">SEATED</span></div>
  </div>`;
  document.body.appendChild(o);
});
await p.evaluate(() => document.fonts.ready);
await p.waitForTimeout(1500);
await p.screenshot({ path: out, timeout: 600000 });
console.log('wrote', out);
await b.close();
