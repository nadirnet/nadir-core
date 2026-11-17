// "Puppeteer": drives synthetic hands toward shadow-space goals.
// Used for (1) headless solvability tests, (2) the attract/demo mode, (3) recording the demo video.
import { createHand, buildSyntheticHand, basisFromEuler, POSES, blendPose } from './handmodel.js';
import { ShadowCaster, handCenterFor, CFG } from './shadow.js';
import { KIT_W, KIT_H } from './world.js';

const HALF_PI = Math.PI / 2;

export class Puppeteer {
  constructor(cfg = CFG) {
    this.cfg = cfg;
    const big = { ...cfg, W: 420, H: 320 };
    big.sw = big.W * cfg.cell; big.sh = big.H * cfg.cell; big.cell = cfg.cell;
    this.scratch = new ShadowCaster(big);
    this.cache = new Map();
    this.hands = [this._mk(false), this._mk(true)];
    this.out = [createHand(), createHand()];
    this.time = 0;
  }
  _mk(left) {
    return { left, active: false, visible: false, sx: 0, sy: -0.8, t: 2.4, roll: 0, pitch: 0, pose: blendPose({}, POSES.relaxed, POSES.relaxed, 0), poseName: 'relaxed', rate: 6, tgt: { sx: 0, sy: -0.8, t: 2.4, roll: 0, pitch: 0 } };
  }

  // shadow extents (cells) relative to the palm-center shadow point, for a given pose/roll/t
  measure(poseName, roll, t, left = false, pitch = 0) {
    const key = `${poseName}|${roll.toFixed(2)}|${t.toFixed(2)}|${left}|${pitch.toFixed(2)}`;
    let m = this.cache.get(key);
    if (m) return m;
    const h = createHand();
    const P = POSES[poseName];
    buildSyntheticHand(h, { center: handCenterFor(0, 0, t, this.cfg.light), basis: basisFromEuler(roll, pitch, 0), curl: P.curl, spread: P.spread, left });
    const sc = this.scratch; sc.cast([h], this.cfg.light);
    const cx = sc.W / 2, cy = sc.H / 2, b = sc.bbox;
    m = { l: b.x0 - cx, r: b.x1 + 1 - cx, b: b.y0 - cy, t: b.y1 + 1 - cy };
    this.cache.set(key, m);
    return m;
  }

  /**
   * Aim hand i so its shadow satisfies edge constraints (grid cells):
   * { pose, roll, t, cx | left | right, cy | top | bottom, rate, enter }
   */
  place(i, g) {
    const h = this.hands[i];
    const pose = g.pose || 'flat', roll = g.roll ?? 0, t = g.t ?? 2.4, pitch = g.pitch ?? 0;
    const m = this.measure(pose, roll, t, h.left, pitch);
    let gx, gy;
    if (g.cx !== undefined) gx = g.cx - (m.l + m.r) / 2;
    else if (g.left !== undefined) gx = g.left - m.l;
    else if (g.right !== undefined) gx = g.right - m.r;
    else gx = this.cfg.W / 2;
    if (g.cy !== undefined) gy = g.cy - (m.b + m.t) / 2;
    else if (g.top !== undefined) gy = g.top - m.t;
    else if (g.bottom !== undefined) gy = g.bottom - m.b;
    else gy = this.cfg.H / 2;
    const c = this.cfg.cell;
    const sx = gx * c - this.cfg.sw / 2, sy = gy * c - this.cfg.sh / 2;
    if (!h.active) {
      // enter from off-screen so motion looks like a real hand arriving
      const e = g.enter || 'below';
      h.sx = sx + (e === 'left' ? -0.9 : e === 'right' ? 0.9 : 0);
      h.sy = sy + (e === 'below' ? -0.7 : e === 'top' ? 0.7 : 0);
      h.t = t; h.roll = roll; h.pitch = pitch;
      h.active = true; h.visible = true;
    }
    h.tgt = { sx, sy, t, roll, pitch };
    h.poseName = pose; h.rate = g.rate ?? 6;
    return m;
  }
  release(i, dir = 'below') {
    const h = this.hands[i];
    if (!h.active) return;
    h.active = false;
    h.tgt = { ...h.tgt, sx: h.tgt.sx + (dir === 'left' ? -1.2 : dir === 'right' ? 1.2 : 0), sy: h.tgt.sy + (dir === 'below' ? -1.0 : dir === 'top' ? 1.0 : 0) };
    h.rate = 3.5;
  }
  releaseAll() { this.release(0); this.release(1); }

  update(dt) {
    this.time += dt;
    for (let i = 0; i < 2; i++) {
      const h = this.hands[i];
      if (!h.visible) { this.out[i].valid = false; continue; }
      const a = 1 - Math.exp(-h.rate * dt);
      h.sx += (h.tgt.sx - h.sx) * a; h.sy += (h.tgt.sy - h.sy) * a;
      h.t += (h.tgt.t - h.t) * a; h.roll += (h.tgt.roll - h.roll) * a; h.pitch += (h.tgt.pitch - h.pitch) * a;
      blendPose(h.pose, h.pose, POSES[h.poseName], 1 - Math.exp(-8 * dt));
      if (!h.active && Math.hypot(h.tgt.sx - h.sx, h.tgt.sy - h.sy) < 0.05) { h.visible = false; this.out[i].valid = false; continue; }
      // tiny human sway
      const sw = 0.0012 * Math.sin(this.time * 1.7 + i * 2) , sv = 0.0012 * Math.sin(this.time * 2.3 + i);
      const c = handCenterFor(h.sx, h.sy, h.t, this.cfg.light);
      c[0] += sw; c[1] += sv;
      buildSyntheticHand(this.out[i], { center: c, basis: basisFromEuler(h.roll + (h.left ? Math.PI : 0) * 0, h.pitch, 0), curl: h.pose.curl, spread: h.pose.spread, left: h.left });
    }
    return this.out;
  }
}

// ---------------- level strategies ----------------
const kitCx = k => k.x + KIT_W / 2;

export function botLevel(game, pup, dt) {
  const w = game.world; if (!w) return;
  const k = w.kit, id = w.level.id;
  const B = pup.botState || (pup.botState = { phase: 0, t: 0 });
  B.t += dt;
  if (k.state === 'win') { if (B.t > 0.6) pup.releaseAll(); return; }
  if (k.state === 'dead') { if (!B.dead) { B.dead = true; B.phase = 0; B.lift = null; B.t = 0; } } else B.dead = false;

  if (id === 'gap') {
    pup.place(0, { pose: 'flat', roll: HALF_PI, t: 2.7, cx: 80, top: 36, enter: 'below', rate: 5 });
  } else if (id === 'lift') {
    lift(pup, 0, k, B, { minX: 22, maxX: 64, dir: 1, target: 60, edge: 112, side: 'right' });
  } else if (id === 'embers') {
    if (k.state !== 'sleep' || B.t > 0.5)
      pup.place(0, { pose: 'flat', roll: HALF_PI, t: 2.3, cx: kitCx(k) + k.dir * 5, bottom: k.y + KIT_H + 5, enter: 'left', rate: 7 });
  } else if (id === 'turn') {
    // right hand: wall before the pit. left hand: lift Kit onto the platform once it's heading home.
    if (B.phase === 0) {
      pup.place(1, { pose: 'flat', roll: 0, t: 2.2, cx: 96, bottom: 2, enter: 'below', rate: 6 });
      if (k.dir === -1) { B.phase = 1; B.t = 0; }
    } else {
      if (B.t > 1.2) pup.release(1, 'right');
      lift(pup, 0, k, B, { minX: 44, maxX: 90, dir: -1, target: 34, edge: 40, side: 'left' });
    }
  } else if (id === 'home') {
    const umbrella = () => pup.place(1, { pose: 'flat', roll: HALF_PI, t: 2.2, cx: kitCx(k) + 4, bottom: k.y + KIT_H + 5, enter: 'right', rate: 7 });
    if (B.phase === 0) { // bridge off the first cliff, drop onto the middle platform
      pup.place(0, { pose: 'flat', roll: HALF_PI, t: 2.6, cx: 46, top: 43, enter: 'below', rate: 5 });
      if (k.x > 50 && k.state === 'walk') umbrella();
      if (k.x > 66 && k.grounded && k.y < 22) { B.phase = 1; B.t = 0; }
    } else if (B.phase === 1) { // shelter through the embers, release the bridge
      pup.release(0, 'below');
      umbrella();
      if (k.x > 76) { B.phase = 2; B.t = 0; B.lift = null; }
    } else {
      pup.place(1, { pose: 'flat', roll: HALF_PI, t: 2.2, cx: kitCx(k) + 4, bottom: 72, rate: 5 });
      lift(pup, 0, k, B, { minX: 76, maxX: 106, dir: 1, target: 58, edge: 128, side: 'right', rate: 30 });
    }
  }
}

function lift(pup, hi, k, B, o) {
  const L = B.lift || (B.lift = { on: false, top: 0 });
  if (!L.on) {
    if (k.state === 'walk' && k.grounded && k.dir === o.dir && k.x >= o.minX && k.x <= o.maxX) { L.on = true; L.top = k.y; }
    else return;
  }
  L.top = Math.min(o.target, L.top + (o.rate || 34) * (1 / 60));
  const m = pup.measure('flat', HALF_PI, 2.5, pup.hands[hi].left);
  const half = (m.r - m.l) / 2;
  let cx = kitCx(k);
  if (L.top >= o.target - 0.5) cx += o.dir * 10;
  if (o.side === 'right') cx = Math.min(cx, o.edge - half + 10); else cx = Math.max(cx, o.edge + half - 10);
  pup.place(hi, { pose: 'flat', roll: HALF_PI, t: 2.5, cx, top: L.top, enter: 'below', rate: 9 });
}

// menu helpers
export function botSelect(game, pup, id) {
  const c = game.cards.find(c => c.id === id);
  if (!c) return false;
  pup.place(0, { pose: 'flat', roll: 0.15, t: 2.0, cx: c.x + c.w / 2, cy: c.y + c.h / 2, enter: 'below', rate: 4 });
  return true;
}

export function botHarp(game, pup, t) {
  const sweep = Math.sin(t * 0.9);
  pup.place(0, { pose: 'open', roll: 0.25 * Math.sin(t * 0.7), t: 1.8 + 0.25 * Math.sin(t * 0.5), cx: 80 + sweep * 52, cy: 46 + 10 * Math.sin(t * 1.3), enter: 'below', rate: 5 });
  if (t > 6) pup.place(1, { pose: 'rabbit', roll: -0.2, t: 2.1, cx: 80 - sweep * 46, cy: 58 + 8 * Math.cos(t * 1.1), enter: 'right', rate: 5 });
}
