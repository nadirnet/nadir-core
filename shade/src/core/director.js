// Scripted tour used for attract mode, the recorded demo video, and the headless end-to-end test.
import { botLevel, botSelect, botHarp } from './bot.js';
import { LEVELS } from './levels.js';

export class Director {
  constructor(game, pup, plan = LEVELS.map(l => l.id).concat('harp'), opts = {}) {
    this.game = game; this.pup = pup; this.plan = plan; this.idx = 0;
    this.harpTime = opts.harpTime ?? 12;
    this.done = false; this.lastMode = null; this.modeT = 0; this.log = [];
  }
  get target() { return this.plan[this.idx]; }

  step(dt) {
    const g = this.game, p = this.pup;
    if (g.mode !== this.lastMode || (g.mode === 'level' && this.lastLevel !== g.levelIndex)) {
      if (this.lastMode === 'complete') this.idx++;
      this.log.push({ t: g.t, mode: g.mode, level: g.levelIndex });
      this.lastMode = g.mode; this.lastLevel = g.levelIndex; this.modeT = 0;
      p.botState = null; p.releaseAll();
    }
    this.modeT += dt;
    if (this.modeT < 0.9 || this.done) return;
    if (g.mode === 'menu') {
      botSelect(g, p, this.target);
    } else if (g.mode === 'level') {
      if (g.world.level.id === this.target) botLevel(g, p, dt);
      else p.releaseAll();
    } else if (g.mode === 'complete') {
      if (this.modeT < 1.6) return;
      const nextId = this.plan[this.idx + 1];
      if (!nextId) { this.done = true; p.releaseAll(); return; }
      const seq = nextId === LEVELS[g.levelIndex + 1]?.id || (nextId === 'harp' && g.levelIndex === LEVELS.length - 1);
      botSelect(g, p, seq ? 'next' : 'menu');
    } else if (g.mode === 'harp') {
      botHarp(g, p, this.modeT - 0.9);
      if (this.modeT > this.harpTime) { this.idx++; this.done = this.idx >= this.plan.length; p.releaseAll(); }
    }
  }
}
