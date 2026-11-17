// Headless end-to-end: the puppeteer bot must clear every level using only hand shadows.
import { CFG, ShadowCaster } from '../src/core/shadow.js';
import { Game } from '../src/core/game.js';
import { Puppeteer } from '../src/core/bot.js';
import { Director } from '../src/core/director.js';
import { LEVELS } from '../src/core/levels.js';

const dt = 1 / 60;
function run(plan, assist = false, limit = 400) {
  const store = { data: { stars: {}, assist }, save() {} };
  const game = new Game(CFG, store), pup = new Puppeteer(CFG), dir = new Director(game, pup, plan, { harpTime: 8 });
  const caster = new ShadowCaster(CFG);
  const res = {}; let cur = null, start = 0, deaths = 0, plucks = 0;
  for (let f = 0; f < limit * 60 && !dir.done; f++) {
    dir.step(dt);
    const hands = pup.update(dt);
    caster.cast(hands);
    game.step(dt, caster.grid, caster.count);
    for (const e of game.drainEvents()) {
      if (e.type === 'level') { cur = LEVELS[e.i].id; start = game.t; deaths = 0; }
      if (e.type === 'poof') deaths++;
      if (e.type === 'win') res[cur] = { time: +(game.t - start).toFixed(1), stars: e.stars, deaths };
      if (e.type === 'pluck') plucks++;
    }
  }
  return { res, total: +game.t.toFixed(1), done: dir.done, plucks, log: dir.log };
}

let fail = 0;
for (const assist of [false, true]) {
  const r = run(LEVELS.map(l => l.id).concat('harp'), assist);
  console.log(`assist=${assist} total=${r.total}s done=${r.done} plucks=${r.plucks}`);
  for (const l of LEVELS) {
    const x = r.res[l.id];
    console.log(`  ${l.id.padEnd(7)} ${x ? `WON in ${x.time}s stars=${x.stars} deaths=${x.deaths}` : 'NOT WON'}`);
    if (!x) fail++;
  }
  if (!r.done) { fail++; console.log(r.log); }
}
// Raster sanity: a flat hand shadow should be roughly hand-sized x magnification
{
  const pup = new Puppeteer(CFG);
  const m = pup.measure('flat', 0, 2.5);
  console.log('flat hand @2.5x shadow cells w,h =', m.r - m.l, m.t - m.b);
}
if (fail) { console.error(`FAIL (${fail})`); process.exit(1); } else console.log('ALL LEVELS SOLVABLE');
