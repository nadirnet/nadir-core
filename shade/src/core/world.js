// 2D sim on the paper screen: Kit (an autonomous paper fox), embers, fireflies, door.
// Solid = paper-cut terrain OR the live hand-shadow grid.
export const KIT_W = 6, KIT_H = 9;
const G = 170, TERM = 95, MAX_LIFT = 16, STEP_UP = 5;

export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class World {
  constructor(level, cfg, opts = {}) {
    this.level = level; this.W = cfg.W; this.H = cfg.H;
    this.terrain = new Uint8Array(this.W * this.H);
    for (const [x0, y0, x1, y1] of level.terrain)
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) this.terrain[y * this.W + x] = 1;
    this.shadow = new Uint8Array(this.W * this.H);
    this.flies = level.fireflies.map(([x, y]) => ({ x, y, got: false }));
    this.embers = [];
    this.emberAcc = 0;
    this.rng = mulberry32(opts.seed ?? 7);
    this.speed = opts.assist ? 8 : 14;
    this.emberSpeed = opts.assist ? 0.6 : 1;
    this.events = [];
    this.time = 0; this.deaths = 0; this.won = false;
    this.kit = null; this.respawn(true);
  }

  respawn(first = false) {
    const s = this.level.kit;
    this.kit = { x: s.x, y: s.y, vy: 0, dir: s.dir, state: 'sleep', t: 0, minSleep: first ? 0.6 : 0.9, grounded: true, ghost: false, walkPhase: 0, fallFrom: s.y };
  }

  emit(type, data = {}) { this.events.push({ type, ...data }); }

  solid(x, y) {
    if (x < 0 || x >= this.W) return 1;
    if (y < 0 || y >= this.H) return 0;
    const i = y * this.W + x;
    return this.terrain[i] | this.shadow[i];
  }
  boxFree(x, y, w = KIT_W, h = KIT_H) {
    const x0 = Math.floor(x), x1 = Math.floor(x + w - 1e-3), y0 = Math.floor(y), y1 = Math.floor(y + h - 1e-3);
    for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) if (this.solid(cx, cy)) return false;
    return true;
  }
  rowFree(x, row) {
    const x0 = Math.floor(x), x1 = Math.floor(x + KIT_W - 1e-3);
    for (let cx = x0; cx <= x1; cx++) if (this.solid(cx, row)) return false;
    return true;
  }

  step(dt, shadowGrid, shadowCount) {
    this.shadow = shadowGrid;
    this.time += dt;
    this._embers(dt);
    this._kit(dt, shadowCount);
  }

  _embers(dt) {
    const e = this.level.embers;
    if (e) {
      this.emberAcc += e.rate * this.emberSpeed * dt;
      while (this.emberAcc >= 1) {
        this.emberAcc -= 1;
        this.embers.push({ x: e.x0 + this.rng() * (e.x1 - e.x0), y: this.H + 2, vy: -(34 + this.rng() * 14) * this.emberSpeed, vx: (this.rng() - 0.5) * 5, life: 0 });
      }
    }
    const k = this.kit;
    for (let i = this.embers.length - 1; i >= 0; i--) {
      const m = this.embers[i];
      m.x += m.vx * dt; m.y += m.vy * dt; m.life += dt;
      const cx = Math.floor(m.x), cy = Math.floor(m.y);
      if (cy < 0) { this.embers.splice(i, 1); continue; }
      if (cy < this.H && cx >= 0 && cx < this.W && this.solid(cx, cy)) {
        this.emit('fizzle', { x: m.x, y: m.y, onShadow: !!this.shadow[cy * this.W + cx] });
        this.embers.splice(i, 1); continue;
      }
      if ((k.state === 'walk' || k.state === 'sleep') && m.x >= k.x && m.x <= k.x + KIT_W && m.y >= k.y && m.y <= k.y + KIT_H) {
        this.embers.splice(i, 1);
        this._die('burn');
      }
    }
  }

  _die(cause) {
    const k = this.kit;
    if (k.state === 'dead' || k.state === 'win') return;
    k.state = 'dead'; k.t = 0; this.deaths++;
    this.emit('poof', { x: k.x + KIT_W / 2, y: k.y + KIT_H / 2, cause });
  }

  _kit(dt, shadowCount) {
    const k = this.kit;
    k.t += dt;
    if (k.state === 'dead') { if (k.t > 1.1) { this.respawn(); this.emit('respawn'); } return; }
    if (k.state === 'win') return;
    if (k.state === 'sleep') {
      if (k.t > k.minSleep && (shadowCount > 40 || k.t > (this.level.wakeAfter ?? 7))) { k.state = 'walk'; k.t = 0; this.emit('wake'); }
      else return;
    }

    // carried / pushed out by a shadow that moved into Kit
    if (!this.boxFree(k.x, k.y)) {
      const yi = Math.floor(k.y);
      let lifted = false;
      for (let d = 1; d <= MAX_LIFT; d++) if (this.boxFree(k.x, yi + d)) { k.y = yi + d; k.vy = Math.max(0, k.vy); lifted = true; break; }
      k.ghost = !lifted;
    } else k.ghost = false;

    // horizontal
    const nx = k.x + k.dir * this.speed * dt;
    if (k.ghost || this.boxFree(nx, k.y)) { k.x = nx; }
    else {
      let stepped = false;
      if (k.grounded) for (let s = 1; s <= STEP_UP; s++) if (this.boxFree(nx, Math.floor(k.y) + s)) { k.x = nx; k.y = Math.floor(k.y) + s; stepped = true; break; }
      if (!stepped) { k.dir = -k.dir; this.emit('turn', { x: k.x, y: k.y }); }
    }
    k.walkPhase += dt * this.speed * 0.9;

    // vertical
    if (k.ghost) { k.vy = 0; }
    else {
      const yi = Math.floor(k.y);
      const onGround = (k.y - yi < 1e-3) && !this.rowFree(k.x, yi - 1);
      if (onGround && k.vy <= 0) { k.vy = 0; k.y = yi; if (!k.grounded) this._land(); k.grounded = true; }
      else {
        if (k.grounded) k.fallFrom = k.y;
        k.grounded = false;
        k.vy = Math.max(k.vy - G * dt, -TERM);
        let ny = k.y + k.vy * dt;
        if (k.vy < 0) {
          for (let r = Math.floor(k.y) - 1; r >= Math.floor(ny); r--) {
            if (r < 0) break;
            if (!this.rowFree(k.x, r)) { ny = r + 1; k.vy = 0; k.grounded = true; this._land(); break; }
          }
        }
        k.y = ny;
      }
    }
    if (k.y < -KIT_H - 2) { this._die('fall'); return; }

    // pickups + door
    const cx = k.x + KIT_W / 2, cy = k.y + KIT_H / 2;
    for (const f of this.flies) if (!f.got && Math.hypot(f.x - cx, f.y - cy) < 6.5) { f.got = true; this.emit('firefly', { x: f.x, y: f.y }); }
    const d = this.level.door;
    if (Math.abs(cx - d.x) < 4 && Math.abs(k.y - d.y) < 3) {
      k.state = 'win'; this.won = true;
      this.emit('win', { stars: this.stars() });
    }
  }

  _land() {
    const k = this.kit;
    if (k.fallFrom - k.y > 6) this.emit('land', { x: k.x + KIT_W / 2, y: k.y, h: k.fallFrom - k.y });
  }

  stars() { return this.flies.filter(f => f.got).length; }
}
