// Paints the paper screen (Canvas2D) from game state. Same grid that drives physics.
import { KIT_W, KIT_H, mulberry32 } from '../core/world.js';
import { LEVELS } from '../core/levels.js';

const S = 4; // logical px per cell
// supersampling for the paper screen (?hires renders it 3x sharper, used for stills/thumbnails)
const K = (typeof location !== 'undefined' && new URLSearchParams(location.search).has('hires')) ? 3 : 1;
const INK = 'rgba(18,12,26,';

export class Painter {
  constructor(cfg) {
    this.cfg = cfg; this.W = cfg.W; this.H = cfg.H;
    this.canvas = document.createElement('canvas');
    this.LW = this.W * S; this.LH = this.H * S;
    this.canvas.width = this.LW * K; this.canvas.height = this.LH * K;
    this.ctx = this.canvas.getContext('2d');
    this.shadowC = document.createElement('canvas'); this.shadowC.width = this.W; this.shadowC.height = this.H;
    this.sctx = this.shadowC.getContext('2d');
    this.shadowImg = this.sctx.createImageData(this.W, this.H);
    this.vecC = document.createElement('canvas'); this.vecC.width = this.W * S * K; this.vecC.height = this.H * S * K;
    this.vctx = this.vecC.getContext('2d');
    this.paper = this._makePaper();
    this.terrainCache = new Map();
    this.particles = [];
    this.rng = mulberry32(3);
    this.banner = null; this.flash = 0;
    this.time = 0;
    this.kitSmooth = null;
    this.hq = true;
  }

  X(x) { return x * S; }
  Y(y) { return (this.H - y) * S; }

  _makePaper() {
    const c = document.createElement('canvas'); c.width = this.W * S * K; c.height = this.H * S * K;
    const g = c.getContext('2d'), w = this.LW, h = this.LH, r = mulberry32(42);
    g.setTransform(K, 0, 0, K, 0, 0);
    g.fillStyle = '#f2dfb8'; g.fillRect(0, 0, w, h);
    // warm lantern hotspot (light comes from below-center)
    const rad = g.createRadialGradient(w / 2, h * 0.82, 20, w / 2, h * 0.7, w * 0.75);
    rad.addColorStop(0, 'rgba(255,214,140,0.85)'); rad.addColorStop(0.5, 'rgba(250,200,130,0.25)'); rad.addColorStop(1, 'rgba(90,50,20,0.55)');
    g.fillStyle = rad; g.fillRect(0, 0, w, h);
    // fibers
    for (let i = 0; i < 900; i++) {
      const x = r() * w, y = r() * h, l = 4 + r() * 18, a = r() * Math.PI;
      g.strokeStyle = r() < 0.5 ? 'rgba(120,80,40,0.07)' : 'rgba(255,255,240,0.12)';
      g.lineWidth = 0.6 + r();
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
    }
    // vignette
    const v = g.createRadialGradient(w / 2, h / 2, h * 0.3, w / 2, h / 2, w * 0.62);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(40,18,8,0.5)');
    g.fillStyle = v; g.fillRect(0, 0, w, h);
    return c;
  }

  _terrain(level) {
    if (this.terrainCache.has(level.id)) return this.terrainCache.get(level.id);
    const c = document.createElement('canvas'); c.width = this.W * S * K; c.height = this.H * S * K;
    const g = c.getContext('2d'); g.setTransform(K, 0, 0, K, 0, 0);
    const r = mulberry32(level.id.length * 97);
    const d = level.decor || {};
    // background papercut layers
    if (d.moon) {
      g.fillStyle = 'rgba(255,246,220,0.75)';
      g.beginPath(); g.arc(this.X(d.moon[0]), this.Y(d.moon[1]), 34, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(232,200,150,0.5)';
      g.beginPath(); g.arc(this.X(d.moon[0]) + 9, this.Y(d.moon[1]) - 6, 28, 0, Math.PI * 2); g.fill();
    }
    if (d.hills) {
      g.fillStyle = 'rgba(176,120,80,0.22)';
      g.beginPath(); g.moveTo(0, this.Y(0));
      for (let x = 0; x <= this.W; x += 4) g.lineTo(this.X(x), this.Y(30 + 10 * Math.sin(x * 0.05) + 6 * Math.sin(x * 0.13 + 1)));
      g.lineTo(this.X(this.W), this.Y(0)); g.fill();
      // little papercut pines
      for (let i = 0; i < 9; i++) {
        const x = 8 + r() * 144, base = 28 + 10 * Math.sin(x * 0.05), hgt = 8 + r() * 10;
        g.beginPath(); g.moveTo(this.X(x), this.Y(base + hgt)); g.lineTo(this.X(x - 3), this.Y(base)); g.lineTo(this.X(x + 3), this.Y(base)); g.fill();
      }
    }
    if (d.clouds) {
      g.fillStyle = 'rgba(160,90,70,0.16)';
      for (let i = 0; i < 5; i++) {
        const x = 20 + i * 30 + r() * 10, y = 82 + r() * 10;
        for (let j = 0; j < 4; j++) { g.beginPath(); g.arc(this.X(x + j * 4), this.Y(y + Math.sin(j) * 2), 14 + r() * 8, 0, Math.PI * 2); g.fill(); }
      }
    }
    // foreground terrain: crimson paper-cut with scalloped edge + cutout motifs
    for (const [x0, y0, x1, y1] of level.terrain) {
      const px = this.X(x0), py = this.Y(y1), pw = (x1 - x0) * S, ph = (y1 - y0) * S;
      const grd = g.createLinearGradient(0, py, 0, py + ph);
      grd.addColorStop(0, '#9b2a2f'); grd.addColorStop(1, '#5a1420');
      g.fillStyle = grd; g.fillRect(px, py, pw, ph);
      // scalloped top
      g.fillStyle = '#b4373a';
      for (let x = px; x < px + pw; x += 8) { g.beginPath(); g.arc(x + 4, py + 1, 4, Math.PI, 0); g.fill(); }
      g.fillRect(px, py, pw, 3);
      // cut-out motifs
      g.fillStyle = 'rgba(242,223,184,0.22)';
      for (let yy = py + 16; yy < py + ph - 8; yy += 18) for (let xx = px + 10 + ((yy / 18) % 2) * 9; xx < px + pw - 8; xx += 18) {
        g.beginPath(); g.moveTo(xx, yy - 5); g.lineTo(xx + 5, yy); g.lineTo(xx, yy + 5); g.lineTo(xx - 5, yy); g.fill();
      }
    }
    this.terrainCache.set(level.id, c);
    return c;
  }

  onEvents(events, game) {
    for (const e of events) {
      if (e.type === 'poof') this._burst(e.x, e.y, 26, ['#ff9a3c', '#ffd28a', '#c04a2a', '#fff2d0'], 40);
      else if (e.type === 'fizzle') { if (e.onShadow) this._burst(e.x, e.y, 3, ['rgba(255,170,80,0.9)', 'rgba(120,110,110,0.6)'], 14); }
      else if (e.type === 'firefly') this._burst(e.x, e.y, 14, ['#f4ff9a', '#d6ff6a', '#ffffff'], 26);
      else if (e.type === 'win') { const d = game.world.level.door; this._burst(d.x, d.y + 8, 40, ['#ffe08a', '#fff6d8', '#ffb347'], 50); this.flash = 1; }
      else if (e.type === 'land') this._burst(e.x, e.y, 6, ['rgba(90,60,40,0.5)'], 10);
      else if (e.type === 'level') this.banner = { text: e.name, sub: LEVELS[e.i].hint, t: 0 };
      else if (e.type === 'pluck') this._burst(e.x, e.y, 6, ['#ffe7a8', '#ffffff'], 18);
      else if (e.type === 'select') this.flash = 0.6;
    }
  }

  _burst(x, y, n, colors, sp) {
    for (let i = 0; i < n; i++) {
      const a = this.rng() * Math.PI * 2, v = sp * (0.3 + this.rng());
      this.particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v + sp * 0.3, life: 0.6 + this.rng() * 0.7, t: 0, c: colors[i % colors.length], s: 1 + this.rng() * 2.2, rot: this.rng() * 6 });
    }
  }

  paint(game, dt, caster) {
    this.time += dt;
    const g = this.ctx, w = this.LW, h = this.LH;
    g.setTransform(K, 0, 0, K, 0, 0);
    g.globalAlpha = 1; g.drawImage(this.paper, 0, 0, w, h);

    if (game.mode === 'level' || game.mode === 'complete') this._paintLevel(game, dt);
    if (game.mode === 'harp') this._paintHarp(game);

    // the hand shadow
    if (caster && caster.prims) this._paintVectorShadow(caster.prims); else this._paintShadow(game.grid);

    if (game.mode === 'level' || game.mode === 'complete') this._paintActors(game, dt);
    if (game.mode === 'menu') this._paintMenu(game);
    if (game.mode === 'complete') this._paintComplete(game);
    for (const c of game.cards) this._card(c, game);

    this._paintParticles(dt);
    this._paintBanner(dt);

    if (this.flash > 0) { g.fillStyle = `rgba(255,236,190,${this.flash * 0.35})`; g.fillRect(0, 0, w, h); this.flash = Math.max(0, this.flash - dt * 1.6); }
  }

  // Smooth shadow drawn from the same projected bones that fill the physics grid.
  _paintVectorShadow(prims) {
    const v = this.vctx, H = this.H;
    v.setTransform(1, 0, 0, 1, 0, 0); v.clearRect(0, 0, this.vecC.width, this.vecC.height); v.setTransform(K, 0, 0, K, 0, 0);
    v.fillStyle = 'rgb(22,14,30)';
    for (let i = 0; i < prims.length;) {
      v.beginPath();
      if (prims[i] === 0) {
        const ax = prims[i + 1] * S, ay = (H - prims[i + 2]) * S, ar = prims[i + 3] * S, bx = prims[i + 4] * S, by = (H - prims[i + 5]) * S, br = prims[i + 6] * S;
        v.arc(ax, ay, ar, 0, Math.PI * 2); v.fill();
        v.beginPath(); v.arc(bx, by, br, 0, Math.PI * 2); v.fill();
        v.beginPath();
        const dx = bx - ax, dy = by - ay, l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l;
        v.moveTo(ax + nx * ar, ay + ny * ar); v.lineTo(bx + nx * br, by + ny * br); v.lineTo(bx - nx * br, by - ny * br); v.lineTo(ax - nx * ar, ay - ny * ar); v.closePath();
        i += 7;
      } else {
        const p = prims[i + 1];
        v.moveTo(p[0] * S, (H - p[1]) * S);
        for (let k = 2; k < p.length; k += 2) v.lineTo(p[k] * S, (H - p[k + 1]) * S);
        v.closePath();
        i += 2;
      }
      v.fill();
    }
    const g = this.ctx;
    g.save();
    if (this.hq) {
      g.globalAlpha = 0.45; g.filter = `blur(${7 * K}px)`; g.drawImage(this.vecC, 0, 0, this.LW, this.LH);
      g.globalAlpha = 0.93; g.filter = `blur(${1.2 * K}px)`; g.drawImage(this.vecC, 0, 0, this.LW, this.LH);
    } else {
      g.globalAlpha = 0.3; g.drawImage(this.vecC, -3, -2, this.LW + 6, this.LH + 4);
      g.globalAlpha = 0.93; g.drawImage(this.vecC, 0, 0, this.LW, this.LH);
    }
    g.restore();
  }

  _paintShadow(grid) {
    if (!grid) return;
    const d = this.shadowImg.data, n = this.W * this.H;
    for (let y = 0; y < this.H; y++) {
      const row = (this.H - 1 - y) * this.W;
      for (let x = 0; x < this.W; x++) {
        const v = grid[y * this.W + x], o = (row + x) * 4;
        d[o] = 22; d[o + 1] = 14; d[o + 2] = 30; d[o + 3] = v ? 238 : 0;
      }
    }
    this.sctx.putImageData(this.shadowImg, 0, 0);
    const g = this.ctx;
    g.save();
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    // soft penumbra: wide faint pass + crisp core
    g.globalAlpha = 0.35; g.drawImage(this.shadowC, -3, -2, this.W * S + 6, this.H * S + 4);
    g.globalAlpha = 1; g.drawImage(this.shadowC, 0, 0, this.W * S, this.H * S);
    g.restore();
    void n;
  }

  _paintLevel(game) {
    const g = this.ctx, lv = game.world.level;
    g.drawImage(this._terrain(lv), 0, 0, this.LW, this.LH);
    // door: a glowing paper-lantern doorway home
    const d = lv.door, x = this.X(d.x), y = this.Y(d.y), pulse = 0.75 + 0.25 * Math.sin(this.time * 3);
    const glow = g.createRadialGradient(x, y - 26, 4, x, y - 26, 70);
    glow.addColorStop(0, `rgba(255,220,130,${0.65 * pulse})`); glow.addColorStop(1, 'rgba(255,200,100,0)');
    g.fillStyle = glow; g.fillRect(x - 80, y - 100, 160, 140);
    g.fillStyle = '#4a1a14';
    g.beginPath(); g.moveTo(x - 22, y); g.lineTo(x - 22, y - 36); g.arc(x, y - 36, 22, Math.PI, 0); g.lineTo(x + 22, y); g.fill();
    g.fillStyle = `rgba(255,214,120,${0.9 * pulse + 0.1})`;
    g.beginPath(); g.moveTo(x - 15, y); g.lineTo(x - 15, y - 36); g.arc(x, y - 36, 15, Math.PI, 0); g.lineTo(x + 15, y); g.fill();
    g.strokeStyle = 'rgba(120,50,20,0.6)'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x, y - 50); g.moveTo(x - 15, y - 26); g.lineTo(x + 15, y - 26); g.stroke();
  }

  _paintActors(game, dt) {
    const g = this.ctx, w = game.world;
    // fireflies
    for (const f of w.flies) {
      if (f.got) continue;
      const bx = this.X(f.x + Math.sin(this.time * 2 + f.x) * 1.2), by = this.Y(f.y + Math.cos(this.time * 2.6 + f.y) * 1.2);
      const gl = g.createRadialGradient(bx, by, 1, bx, by, 18);
      gl.addColorStop(0, 'rgba(240,255,150,0.95)'); gl.addColorStop(1, 'rgba(200,255,100,0)');
      g.fillStyle = gl; g.beginPath(); g.arc(bx, by, 18, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#fbffd8'; g.beginPath(); g.arc(bx, by, 3, 0, Math.PI * 2); g.fill();
    }
    // embers
    for (const m of w.embers) {
      const x = this.X(m.x), y = this.Y(m.y);
      g.strokeStyle = 'rgba(255,120,40,0.45)'; g.lineWidth = 3;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x - m.vx * 0.12 * S, y + m.vy * 0.12 * S); g.stroke();
      g.fillStyle = '#ffcf6a'; g.beginPath(); g.arc(x, y, 3.2, 0, Math.PI * 2); g.fill();
    }
    this._kit(w.kit, dt);
  }

  _kit(k, dt) {
    if (k.state === 'dead') return;
    const g = this.ctx;
    // smooth the drawn position slightly (sim snaps to cells when stepping)
    if (!this.kitSmooth || Math.abs(this.kitSmooth.y - k.y) > 12 || Math.abs(this.kitSmooth.x - k.x) > 12) this.kitSmooth = { x: k.x, y: k.y };
    const a = 1 - Math.exp(-dt * 25);
    this.kitSmooth.x += (k.x - this.kitSmooth.x) * a; this.kitSmooth.y += (k.y - this.kitSmooth.y) * a;
    const cx = this.X(this.kitSmooth.x + KIT_W / 2), by = this.Y(this.kitSmooth.y);
    const walking = k.state === 'walk' && k.grounded;
    const bob = walking ? Math.abs(Math.sin(k.walkPhase)) * 2 : 0;
    g.save();
    g.translate(cx, by - bob);
    g.scale(k.dir, 1);
    // little lantern glow it carries
    const gl = g.createRadialGradient(12, -16, 1, 12, -16, 26);
    gl.addColorStop(0, 'rgba(255,230,150,0.55)'); gl.addColorStop(1, 'rgba(255,200,120,0)');
    g.fillStyle = gl; g.fillRect(-20, -48, 60, 60);
    // tail
    g.fillStyle = '#e8772c';
    g.beginPath(); g.moveTo(-8, -14); g.quadraticCurveTo(-22, -20 - Math.sin(this.time * 6) * 3, -18, -32); g.quadraticCurveTo(-12, -22, -4, -18); g.fill();
    g.fillStyle = '#fff1dc'; g.beginPath(); g.arc(-18, -31, 3, 0, Math.PI * 2); g.fill();
    // legs
    g.strokeStyle = '#6b2c12'; g.lineWidth = 2.4; g.lineCap = 'round';
    const lp = walking ? Math.sin(k.walkPhase * 2) * 4 : 0;
    g.beginPath(); g.moveTo(-5, -6); g.lineTo(-5 + lp, 0); g.moveTo(5, -6); g.lineTo(5 - lp, 0); g.stroke();
    // body
    g.fillStyle = '#ff8c32';
    g.beginPath(); g.ellipse(0, -13, 11, 8, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#ffe9cc'; g.beginPath(); g.ellipse(3, -10, 6, 4, 0, 0, Math.PI * 2); g.fill();
    // head
    g.fillStyle = '#ff8c32';
    g.beginPath(); g.arc(9, -24, 7.5, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.moveTo(14, -24); g.lineTo(21, -21); g.lineTo(13, -19); g.fill(); // snout
    g.beginPath(); g.moveTo(4, -29); g.lineTo(5, -38); g.lineTo(10, -30); g.fill(); // ear
    g.beginPath(); g.moveTo(9, -30); g.lineTo(13, -38); g.lineTo(15, -28); g.fill();
    g.fillStyle = '#2a120a';
    if (k.state === 'sleep') { g.fillRect(9, -26, 4, 1.4); }
    else { g.beginPath(); g.arc(11.5, -25.5, 1.5, 0, Math.PI * 2); g.fill(); }
    g.beginPath(); g.arc(21, -21.5, 1.3, 0, Math.PI * 2); g.fill();
    // lantern
    g.strokeStyle = '#6b2c12'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(10, -14); g.lineTo(14, -18); g.stroke();
    g.fillStyle = '#ffd36a'; g.beginPath(); g.ellipse(15, -13, 3, 4, 0, 0, Math.PI * 2); g.fill();
    g.restore();
    if (k.state === 'sleep') {
      g.fillStyle = 'rgba(70,40,30,0.8)'; g.font = 'italic 16px Georgia, serif';
      const z = (this.time * 0.8) % 1;
      g.globalAlpha = 1 - z; g.fillText('z', cx + 10, by - 40 - z * 16); g.globalAlpha = 1;
    }
  }

  _paintMenu(game) {
    const g = this.ctx, w = this.LW;
    g.textAlign = 'center';
    g.fillStyle = 'rgba(60,20,16,0.92)';
    g.font = 'bold 64px Georgia, serif'; g.fillText('S H A D E', w / 2, 74);
    g.font = 'italic 19px Georgia, serif'; g.fillStyle = 'rgba(70,35,24,0.85)';
    g.fillText(game.seenShadow ? 'Hold your shadow over a card to choose.' : 'Raise a hand between the lantern and the screen.', w / 2, 104);
    g.textAlign = 'left';
  }

  _paintComplete(game) {
    const g = this.ctx, w = this.LW, s = game.world.stars();
    g.textAlign = 'center';
    g.fillStyle = 'rgba(60,20,16,0.92)'; g.font = 'bold 40px Georgia, serif';
    g.fillText('Kit made it home', w / 2, 84);
    for (let i = 0; i < 3; i++) this._star(w / 2 - 50 + i * 50, 128, 17, i < s);
    g.font = 'italic 16px Georgia, serif'; g.fillStyle = 'rgba(70,35,24,0.85)';
    g.fillText(s < 3 ? `${3 - s} firefl${3 - s === 1 ? 'y' : 'ies'} still out there…` : 'Every firefly found!', w / 2, 168);
    g.textAlign = 'left';
  }

  _star(x, y, r, on) {
    const g = this.ctx;
    g.beginPath();
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
    g.closePath();
    g.fillStyle = on ? '#e9a21c' : 'rgba(90,50,30,0.18)'; g.fill();
    g.strokeStyle = 'rgba(90,40,20,0.5)'; g.lineWidth = 1.5; g.stroke();
  }

  _card(c) {
    const g = this.ctx, x = this.X(c.x), y = this.Y(c.y + c.h), w = c.w * S, h = c.h * S;
    const lift = c.cover > 0.28 ? 2 : 0;
    g.save();
    g.fillStyle = 'rgba(60,25,10,0.25)'; g.fillRect(x + 4, y + 5, w, h);
    g.fillStyle = c.kind === 'harp' ? '#f6e3c4' : '#fbeed6'; g.fillRect(x, y - lift, w, h);
    g.strokeStyle = '#8b2c2c'; g.lineWidth = 3; g.strokeRect(x + 5, y + 5 - lift, w - 10, h - 10);
    g.fillStyle = '#4a1a14'; g.textAlign = 'center';
    if (c.kind === 'small') { g.font = 'bold 18px Georgia, serif'; g.fillText(c.label, x + w / 2, y + h / 2 + 6); }
    else {
      const parts = c.label.split('. ');
      if (parts.length > 1) { g.font = 'bold 22px Georgia, serif'; g.fillText(parts[0], x + w / 2, y + 34 - lift); g.font = '15px Georgia, serif'; g.fillText(parts[1], x + w / 2, y + 58 - lift); }
      else { g.font = 'bold 19px Georgia, serif'; g.fillText(c.label, x + w / 2, y + (c.kind === 'harp' ? 44 : 58) - lift); }
      if (c.kind === 'harp') { g.font = 'italic 13px Georgia, serif'; g.fillText('free play · music', x + w / 2, y + 66); }
      if (c.stars >= 0) for (let i = 0; i < 3; i++) this._star(x + w / 2 - 22 + i * 22, y + h - 18 - lift, 7, i < c.stars);
    }
    if (c.progress > 0) {
      g.strokeStyle = '#e9a21c'; g.lineWidth = 6; g.lineCap = 'round';
      g.beginPath(); g.arc(x + w / 2, y + h / 2, Math.min(w, h) * 0.42, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, c.progress)); g.stroke();
    }
    g.restore();
  }

  _paintHarp(game) {
    const g = this.ctx;
    g.textAlign = 'center'; g.fillStyle = 'rgba(60,20,16,0.85)'; g.font = 'italic 20px Georgia, serif';
    g.fillText('Shadow Harp: let your shadow brush the strings', this.LW / 2, 36);
    g.textAlign = 'left';
    for (const s of game.harp.strings) {
      const x = this.X(s.x + 0.5), top = this.Y(90), bot = this.Y(10);
      g.strokeStyle = `rgba(${120 + s.amp * 135},${60 + s.amp * 160},${30 + s.amp * 90},0.9)`;
      g.lineWidth = 2 + s.amp * 2;
      g.beginPath(); g.moveTo(x, top);
      for (let i = 1; i <= 20; i++) { const yy = top + (bot - top) * i / 20; g.lineTo(x + Math.sin(i / 20 * Math.PI) * Math.sin(this.time * 60 + s.x) * s.amp * 7, yy); }
      g.stroke();
      g.fillStyle = '#6b2c12'; g.beginPath(); g.arc(x, top, 4, 0, Math.PI * 2); g.arc(x, bot, 4, 0, Math.PI * 2); g.fill();
    }
  }

  _paintParticles(dt) {
    const g = this.ctx;
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.t += dt; if (p.t > p.life) { this.particles.splice(i, 1); continue; }
      p.vy -= 60 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += dt * 5;
      g.globalAlpha = 1 - p.t / p.life; g.fillStyle = p.c;
      g.save(); g.translate(this.X(p.x), this.Y(p.y)); g.rotate(p.rot); g.fillRect(-p.s * 1.5, -p.s, p.s * 3, p.s * 2); g.restore();
    }
    g.globalAlpha = 1;
  }

  _paintBanner(dt) {
    const b = this.banner; if (!b) return;
    b.t += dt;
    const a = b.t < 0.5 ? b.t / 0.5 : b.t > 6 ? Math.max(0, 1 - (b.t - 6) / 0.8) : 1;
    if (a <= 0) { this.banner = null; return; }
    const g = this.ctx, w = this.LW;
    g.globalAlpha = a; g.textAlign = 'center';
    g.fillStyle = 'rgba(60,20,16,0.92)'; g.font = 'bold 28px Georgia, serif'; g.fillText(b.text, w / 2, 40);
    g.font = 'italic 17px Georgia, serif'; g.fillStyle = 'rgba(70,35,24,0.9)'; g.fillText(b.sub, w / 2, 66);
    g.globalAlpha = 1; g.textAlign = 'left';
  }
}
