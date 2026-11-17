// Top-level game flow. Every menu is diegetic: you choose by casting a shadow over a paper card.
import { LEVELS, HARP } from './levels.js';
import { World } from './world.js';

const DWELL = 1.1;
export const HARP_NOTES = [196.0, 220.0, 261.63, 293.66, 329.63, 392.0, 440.0, 523.25]; // G pentatonic-ish

export class Game {
  constructor(cfg, store) {
    this.cfg = cfg; this.W = cfg.W; this.H = cfg.H;
    this.store = store || { data: { stars: {}, assist: false, seenIntro: false }, save() {} };
    this.events = [];
    this.t = 0; this.modeT = 0;
    this.seenShadow = false;
    this.levelIndex = -1; this.world = null;
    this.harp = null;
    this.toMenu();
  }
  get assist() { return !!this.store.data.assist; }
  setAssist(on) {
    this.store.data.assist = on; this.store.save();
    if (this.world) { this.world.speed = on ? 8 : 14; this.world.emberSpeed = on ? 0.6 : 1; }
    this.emit('assist', { on });
  }
  emit(type, data = {}) { this.events.push({ type, ...data }); }
  drainEvents() { const e = this.events; this.events = []; return e; }

  _setMode(m) { this.mode = m; this.modeT = 0; }

  toMenu() {
    this._setMode('menu');
    this.world = null; this.harp = null;
    const cw = 40, ch = 26, xs = [14, 60, 106], ys = [44, 10];
    this.cards = [];
    const items = [...LEVELS.map((l, i) => ({ id: l.id, label: l.name, i })), { id: 'harp', label: HARP.name, i: -1 }];
    items.forEach((it, n) => {
      const x = xs[n % 3], y = ys[Math.floor(n / 3)];
      this.cards.push({
        id: it.id, x, y, w: cw, h: ch, label: it.label, progress: 0, cover: 0,
        stars: it.i >= 0 ? (this.store.data.stars[it.id] || 0) : -1, kind: it.i >= 0 ? 'level' : 'harp',
        action: it.i >= 0 ? () => this.startLevel(it.i) : () => this.startHarp(),
      });
    });
  }

  startLevel(i) {
    this.levelIndex = i;
    this.world = new World(LEVELS[i], this.cfg, { assist: this.assist, seed: 11 + i });
    this.cards = [];
    this._setMode('level');
    this.winT = 0;
    this.emit('level', { i, name: LEVELS[i].name });
  }
  restart() {
    if (this.mode === 'level' || this.mode === 'complete') this.startLevel(this.levelIndex);
    else if (this.mode === 'harp') this.startHarp();
  }

  startHarp() {
    this._setMode('harp');
    this.world = null;
    const n = HARP.strings;
    this.harp = { strings: Array.from({ length: n }, (_, i) => ({ x: Math.round(22 + i * (116 / (n - 1))), amp: 0, on: false, y: 50 })) };
    this.cards = [{ id: 'back', x: 2, y: 84, w: 26, h: 14, label: '‹ Menu', progress: 0, cover: 0, stars: -1, kind: 'small', action: () => this.toMenu() }];
    this.emit('harp');
  }

  _complete() {
    this._setMode('complete');
    const i = this.levelIndex, last = i === LEVELS.length - 1;
    const s = this.world.stars();
    const id = LEVELS[i].id;
    if ((this.store.data.stars[id] || 0) < s) { this.store.data.stars[id] = s; this.store.save(); }
    this.cards = [
      { id: 'next', x: 34, y: 18, w: 40, h: 26, label: last ? 'Shadow Harp' : 'Next ›', progress: 0, cover: 0, stars: -1, kind: 'level', action: last ? () => this.startHarp() : () => this.startLevel(i + 1) },
      { id: 'menu', x: 86, y: 18, w: 40, h: 26, label: 'Menu', progress: 0, cover: 0, stars: -1, kind: 'level', action: () => this.toMenu() },
    ];
  }

  step(dt, grid, count) {
    this.t += dt; this.modeT += dt;
    if (count > 30 && !this.seenShadow) { this.seenShadow = true; this.emit('firstShadow'); }
    this.grid = grid; this.count = count;

    if (this.mode === 'level') {
      this.world.step(dt, grid, count);
      for (const e of this.world.events) this.events.push(e);
      this.world.events.length = 0;
      if (this.world.won) { this.winT += dt; if (this.winT > 2.4) this._complete(); }
    } else if (this.mode === 'harp') {
      this._harp(dt, grid);
    }
    // dwell-select cards (shadow held over a card)
    if (this.modeT > 0.8) for (const c of this.cards) {
      let cov = 0;
      for (let y = c.y; y < c.y + c.h; y++) for (let x = c.x; x < c.x + c.w; x++) cov += grid[y * this.W + x];
      c.cover = cov / (c.w * c.h);
      if (c.cover > 0.28) {
        const before = c.progress;
        c.progress += dt / DWELL;
        if (before === 0) this.emit('hover', { id: c.id });
        if (c.progress >= 1) { this.emit('select', { id: c.id }); c.action(); break; }
      } else c.progress = Math.max(0, c.progress - dt * 1.6);
    }
  }

  _harp(dt, grid) {
    const W = this.W;
    this.harp.strings.forEach((s, i) => {
      let on = false, top = -1;
      for (let y = 10; y < 90; y++) {
        if (grid[y * W + s.x] || grid[y * W + s.x + 1]) { on = true; top = y; }
      }
      if (on && !s.on) { s.amp = 1; this.emit('pluck', { i, freq: HARP_NOTES[i], x: s.x, y: top }); }
      s.on = on; s.y = top;
      s.amp *= Math.exp(-dt * 2.2);
    });
  }
}
