// Projects hand capsules from a point light onto the paper screen (z = 0 plane in theater space)
// and rasterizes them into a solid-cell grid. The same grid is used for gameplay AND rendering,
// so what you see is exactly what Kit can stand on.
import { BONES, PALM, NJ } from './handmodel.js';

export const CFG = {
  W: 160, H: 100,          // grid cells
  sw: 1.12, sh: 0.70,      // screen size (m)
  light: [0, -0.33, 0.62], // lantern position, theater-local
};
CFG.cell = CFG.sw / CFG.W;

export class ShadowCaster {
  constructor(cfg = CFG) {
    this.cfg = cfg;
    this.W = cfg.W; this.H = cfg.H;
    this.grid = new Uint8Array(cfg.W * cfg.H);
    this.count = 0;
    this.px = new Float32Array(NJ); this.py = new Float32Array(NJ); this.pr = new Float32Array(NJ); this.ok = new Uint8Array(NJ);
    this.bbox = { x0: 0, y0: 0, x1: -1, y1: -1 };
  }

  cast(hands, light = this.cfg.light) {
    this.grid.fill(0);
    this.prims = [];
    for (const h of hands) if (h && h.valid) this._castHand(h, light);
    this._stats();
    return this.grid;
  }

  _castHand(h, L) {
    const { cell, sw, sh } = this.cfg;
    const { px, py, pr, ok } = this;
    for (let i = 0; i < NJ; i++) {
      const x = h.pos[i * 3], y = h.pos[i * 3 + 1], z = h.pos[i * 3 + 2];
      const dz = L[2] - z;
      if (dz < 0.015) { ok[i] = 0; continue; }
      const t = L[2] / dz;
      px[i] = (L[0] + (x - L[0]) * t + sw / 2) / cell;
      py[i] = (L[1] + (y - L[1]) * t + sh / 2) / cell;
      pr[i] = t / cell; // scale factor for radii (m -> cells)
      ok[i] = 1;
    }
    for (const [a, b, ro] of BONES) {
      if (!ok[a] || !ok[b]) continue;
      const ra = (ro || h.rad[a]) * pr[a], rb = (ro || h.rad[b]) * pr[b];
      this._capsule(px[a], py[a], ra, px[b], py[b], rb);
      this.prims.push(0, px[a], py[a], ra, px[b], py[b], rb);
    }
    // palm polygon
    const poly = [];
    for (const j of PALM) if (ok[j]) poly.push(px[j], py[j]);
    if (poly.length >= 6) { this._polygon(poly); this.prims.push(1, poly); }
  }

  _capsule(ax, ay, ar, bx, by, br) {
    const W = this.W, H = this.H, g = this.grid;
    const x0 = Math.max(0, Math.floor(Math.min(ax - ar, bx - br))), x1 = Math.min(W - 1, Math.ceil(Math.max(ax + ar, bx + br)));
    const y0 = Math.max(0, Math.floor(Math.min(ay - ar, by - br))), y1 = Math.min(H - 1, Math.ceil(Math.max(ay + ar, by + br)));
    if (x0 > x1 || y0 > y1) return;
    const vx = bx - ax, vy = by - ay, vv = vx * vx + vy * vy || 1e-9;
    for (let y = y0; y <= y1; y++) {
      const cy = y + 0.5;
      for (let x = x0; x <= x1; x++) {
        const cx = x + 0.5;
        let t = ((cx - ax) * vx + (cy - ay) * vy) / vv;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        const dx = cx - (ax + vx * t), dy = cy - (ay + vy * t);
        const r = ar + (br - ar) * t;
        if (dx * dx + dy * dy <= r * r) g[y * W + x] = 1;
      }
    }
  }

  _polygon(p) {
    const W = this.W, H = this.H, g = this.grid, n = p.length / 2;
    let minx = Infinity, maxx = -Infinity, miny = Infinity, maxy = -Infinity;
    for (let i = 0; i < n; i++) { minx = Math.min(minx, p[2 * i]); maxx = Math.max(maxx, p[2 * i]); miny = Math.min(miny, p[2 * i + 1]); maxy = Math.max(maxy, p[2 * i + 1]); }
    const x0 = Math.max(0, Math.floor(minx)), x1 = Math.min(W - 1, Math.ceil(maxx));
    const y0 = Math.max(0, Math.floor(miny)), y1 = Math.min(H - 1, Math.ceil(maxy));
    for (let y = y0; y <= y1; y++) {
      const cy = y + 0.5;
      for (let x = x0; x <= x1; x++) {
        const cx = x + 0.5;
        let inside = false;
        for (let i = 0, j = n - 1; i < n; j = i++) {
          const xi = p[2 * i], yi = p[2 * i + 1], xj = p[2 * j], yj = p[2 * j + 1];
          if ((yi > cy) !== (yj > cy) && cx < ((xj - xi) * (cy - yi)) / (yj - yi) + xi) inside = !inside;
        }
        if (inside) g[y * W + x] = 1;
      }
    }
  }

  _stats() {
    const W = this.W, H = this.H, g = this.grid;
    let c = 0, x0 = W, y0 = H, x1 = -1, y1 = -1;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (g[y * W + x]) {
      c++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
    this.count = c; this.bbox = { x0, y0, x1, y1 };
  }
}

// Inverse helper: palm center position (theater space) whose palm shadow lands at screen point
// (sx, sy) meters with magnification t.
export function handCenterFor(sx, sy, t, L = CFG.light) {
  return [L[0] + (sx - L[0]) / t, L[1] + (sy - L[1]) / t, L[2] - L[2] / t];
}
export function cellToScreen(gx, gy, cfg = CFG) {
  return [gx * cfg.cell - cfg.sw / 2, gy * cfg.cell - cfg.sh / 2];
}
