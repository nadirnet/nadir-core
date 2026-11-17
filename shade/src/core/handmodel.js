// Hand skeleton shared by real WebXR hands, controllers, desktop mouse and the demo bot.
// 25 joints in WebXR XRHand order. Positions are in theater-local meters.

export const NJ = 25;
export const JOINT_NAMES = [
  'wrist',
  'thumb-metacarpal', 'thumb-phalanx-proximal', 'thumb-phalanx-distal', 'thumb-tip',
];
for (const f of ['index', 'middle', 'ring', 'pinky']) {
  JOINT_NAMES.push(
    `${f}-finger-metacarpal`, `${f}-finger-phalanx-proximal`, `${f}-finger-phalanx-intermediate`,
    `${f}-finger-phalanx-distal`, `${f}-finger-tip`);
}

// [a, b, radiusOverride(0 = use joint radii)]
export const BONES = [[0, 1, 0.014], [1, 2, 0], [2, 3, 0], [3, 4, 0]];
for (let k = 0; k < 4; k++) {
  const b = 5 + 5 * k;
  BONES.push([0, b, 0], [b, b + 1, 0], [b + 1, b + 2, 0], [b + 2, b + 3, 0], [b + 3, b + 4, 0]);
}
// palm thickness / knuckle line so an edge-on palm still casts a solid slab
BONES.push([0, 11, 0.016], [0, 6, 0.012], [0, 21, 0.011], [6, 11, 0.010], [11, 16, 0.010], [16, 21, 0.009]);
export const PALM = [0, 1, 6, 11, 16, 21, 20];
export const INDEX_TIP = 9;

export function createHand() {
  return { valid: false, pos: new Float32Array(NJ * 3), rad: new Float32Array(NJ), pinch: 0 };
}

export function copyHand(dst, src) {
  dst.valid = src.valid; dst.pos.set(src.pos); dst.rad.set(src.rad); dst.pinch = src.pinch;
}

// ---------------- synthetic hand ----------------
const META = [[-0.012, 0.02], [-0.003, 0.022], [0.007, 0.02], [0.016, 0.018]];
const KNUCK = [[-0.026, 0.088], [-0.006, 0.094], [0.013, 0.089], [0.030, 0.079]];
const LENS = [[0.039, 0.024, 0.021], [0.044, 0.028, 0.023], [0.041, 0.027, 0.022], [0.032, 0.019, 0.019]];
const SPREAD = [0.16, 0.04, -0.08, -0.2];
const CURL_ANG = [1.25, 1.6, 1.1];
const PALM_C = [0, 0.055, 0];
const FR = [0.011, 0.010, 0.009, 0.008, 0.007];

export const POSES = {
  flat:    { curl: [0.5, 0, 0, 0, 0], spread: 0.1 },
  open:    { curl: [0, 0, 0, 0, 0], spread: 1.6 },
  relaxed: { curl: [0.25, 0.22, 0.28, 0.33, 0.4], spread: 0.5 },
  fist:    { curl: [1, 1, 1, 1, 1], spread: 0 },
  point:   { curl: [0.8, 0, 1, 1, 1], spread: 0 },
  rabbit:  { curl: [0.9, 0, 0, 1, 1], spread: 0.8 },
  cup:     { curl: [0.3, 0.42, 0.42, 0.42, 0.42], spread: 0.1 },
};

export function blendPose(out, a, b, t) {
  out.curl = out.curl || [0, 0, 0, 0, 0];
  for (let i = 0; i < 5; i++) out.curl[i] = a.curl[i] + (b.curl[i] - a.curl[i]) * t;
  out.spread = a.spread + (b.spread - a.spread) * t;
  return out;
}

// Rotation basis from roll (in screen plane), pitch (about x), yaw (about y). Returns [X,Y,Z] 9 numbers.
export function basisFromEuler(roll, pitch = 0, yaw = 0) {
  const out = new Array(9);
  const cr = Math.cos(roll), sr = Math.sin(roll), cp = Math.cos(pitch), sp = Math.sin(pitch), cy = Math.cos(yaw), sy = Math.sin(yaw);
  const base = [[cr, sr, 0], [-sr, cr, 0], [0, 0, 1]];
  for (let i = 0; i < 3; i++) {
    let [x, y, z] = base[i];
    [y, z] = [y * cp - z * sp, y * sp + z * cp];
    [x, z] = [x * cy + z * sy, -x * sy + z * cy];
    out[i * 3] = x; out[i * 3 + 1] = y; out[i * 3 + 2] = z;
  }
  return out;
}

const tmp = new Float32Array(NJ * 3);
function setJ(i, x, y, z) { tmp[i * 3] = x; tmp[i * 3 + 1] = y; tmp[i * 3 + 2] = z; }
function norm(v) { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; }
function lerp3(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }

/**
 * Build a plausible hand skeleton.
 * opts: { center:[x,y,z] palm center, basis: 9 numbers, curl:[5], spread, left:boolean, scale }
 * Local frame (right hand): fingers +y, palm faces -z, thumb toward -x.
 */
export function buildSyntheticHand(hand, opts) {
  const { center, basis, curl, spread = 0.2, left = false, scale = 1 } = opts;
  setJ(0, 0, 0, 0);
  // thumb
  const c = curl[0];
  const dOpen = norm([-0.62, 0.75, -0.22]), dTuck = norm([0.55, 0.55, -0.62]);
  let p = [-0.022, 0.02, -0.008];
  setJ(1, p[0], p[1], p[2]);
  const tl = [0.042, 0.032, 0.028], tk = [0.6, 0.9, 1.2];
  for (let s = 0; s < 3; s++) {
    const d = norm(lerp3(dOpen, dTuck, Math.min(1, c * tk[s])));
    p = [p[0] + d[0] * tl[s], p[1] + d[1] * tl[s], p[2] + d[2] * tl[s]];
    setJ(2 + s, p[0], p[1], p[2]);
  }
  // fingers
  for (let k = 0; k < 4; k++) {
    const b = 5 + 5 * k;
    setJ(b, META[k][0], META[k][1], 0);
    const a = SPREAD[k] * spread;
    const dx = -Math.sin(a), dy = Math.cos(a);
    const kx = KNUCK[k][0] + (dx * 0.004 * spread), ky = KNUCK[k][1];
    setJ(b + 1, kx, ky, 0);
    let px = kx, py = ky, pz = 0, th = 0;
    const cf = curl[k + 1];
    for (let s = 0; s < 3; s++) {
      th += cf * CURL_ANG[s];
      const ct = Math.cos(th), st = Math.sin(th);
      px += (ct * dx) * LENS[k][s]; py += (ct * dy) * LENS[k][s]; pz += -st * LENS[k][s];
      setJ(b + 2 + s, px, py, pz);
    }
  }
  // radii
  hand.rad[0] = 0.02 * scale;
  hand.rad[1] = 0.013 * scale; hand.rad[2] = 0.011 * scale; hand.rad[3] = 0.0095 * scale; hand.rad[4] = 0.008 * scale;
  for (let k = 0; k < 4; k++) for (let s = 0; s < 5; s++) hand.rad[5 + 5 * k + s] = FR[s] * (k === 3 ? 0.88 : 1) * scale;
  // transform
  const B = basis;
  for (let i = 0; i < NJ; i++) {
    let x = tmp[i * 3], y = tmp[i * 3 + 1] - PALM_C[1], z = tmp[i * 3 + 2];
    if (left) x = -x;
    x *= scale; y *= scale; z *= scale;
    hand.pos[i * 3] = center[0] + x * B[0] + y * B[3] + z * B[6];
    hand.pos[i * 3 + 1] = center[1] + x * B[1] + y * B[4] + z * B[7];
    hand.pos[i * 3 + 2] = center[2] + x * B[2] + y * B[5] + z * B[8];
  }
  hand.valid = true;
  return hand;
}
