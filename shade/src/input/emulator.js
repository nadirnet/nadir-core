// Runs SHADE inside Meta's IWER WebXR emulator (an emulated Quest 3 with hand tracking).
// The puppeteer bot decides where each hand should be; this driver steers IWER's emulated
// hands there with a feedback loop, and the game reads them back through the *real*
// WebXR hand-tracking path (XRHands), exactly like on a headset.
import * as THREE from 'three';

const POSE_MAP = { flat: 'flat', open: 'open', fist: 'fist', point: 'point', rabbit: 'peace', relaxed: 'default', cup: 'cup' };
const PALM = [0, 6, 11, 16, 21];

export async function installEmulator() {
  const { XRDevice, metaQuest3 } = await import('iwer');
  const device = new XRDevice(metaQuest3);
  device.installRuntime({ forceInstall: true });
  device.primaryInputMode = 'hand';
  device.stereoEnabled = false;
  device.position.set(0, 1.2, 0);
  const pitch = -0.32; // seated player glancing down toward the lantern
  device.quaternion.set(Math.sin(pitch / 2), 0, 0, Math.cos(pitch / 2));
  return device;
}

function frameOf(pos, out) {
  // palm center, finger direction (wrist -> middle knuckle), palm normal
  const c = out.c.set(0, 0, 0);
  for (const j of PALM) c.add(out.t.set(pos[j * 3], pos[j * 3 + 1], pos[j * 3 + 2]));
  c.multiplyScalar(1 / PALM.length);
  const w = out.t.set(pos[0], pos[1], pos[2]);
  out.f.set(pos[33] - w.x, pos[34] - w.y, pos[35] - w.z).normalize();
  const a = new THREE.Vector3(pos[18] - pos[0], pos[19] - pos[1], pos[20] - pos[2]);   // wrist->index knuckle
  const b = new THREE.Vector3(pos[63] - pos[0], pos[64] - pos[1], pos[65] - pos[2]);   // wrist->pinky knuckle
  out.n.crossVectors(a, b).normalize();
  out.s.crossVectors(out.f, out.n).normalize();
  out.n.crossVectors(out.s, out.f).normalize();
  out.m.makeBasis(out.f, out.n, out.s);
  return out;
}
const mk = () => ({ c: new THREE.Vector3(), f: new THREE.Vector3(), n: new THREE.Vector3(), s: new THREE.Vector3(), t: new THREE.Vector3(), m: new THREE.Matrix4() });

export class EmulatorDriver {
  constructor(device) {
    this.device = device;
    this.want = mk(); this.have = mk();
    this.q = new THREE.Quaternion(); this.dq = new THREE.Quaternion(); this.tm = new THREE.Matrix4();
    this.wc = new THREE.Vector3(); this.hc = new THREE.Vector3();
  }

  // bot hands (theater-local) -> steer IWER hands so the real tracked joints match them
  drive(botHands, botStates, xrHands, theaterRoot) {
    const byHand = { right: null, left: null };
    for (let i = 0; i < 2; i++) {
      const src = xrHands.grips[i].userData.src;
      if (src && src.handedness) byHand[src.handedness] = xrHands.out[i];
    }
    const rot = new THREE.Quaternion().setFromRotationMatrix(this.tm.extractRotation(theaterRoot.matrixWorld));
    [['right', 0], ['left', 1]].forEach(([side, i]) => {
      const ih = this.device.hands[side], bot = botHands[i], st = botStates[i];
      if (!bot.valid) { ih.position.set(side === 'right' ? 0.6 : -0.6, 0.3, 0.3); return; }
      const want = POSE_MAP[st.poseName] || 'flat';
      if (ih.poseId !== want) ih.poseId = want;
      const have = byHand[side];
      frameOf(bot.pos, this.want);
      this.wc.copy(this.want.c); theaterRoot.localToWorld(this.wc);
      if (!have || !have.valid) { ih.position.set(this.wc.x, this.wc.y, this.wc.z); return; }
      frameOf(have.pos, this.have);
      this.hc.copy(this.have.c); theaterRoot.localToWorld(this.hc);
      // translation feedback
      const e = this.wc.sub(this.hc).multiplyScalar(0.85);
      ih.position.set(ih.position.x + e.x, ih.position.y + e.y, ih.position.z + e.z);
      // rotation feedback: delta = want * have^-1 (in theater frame), mapped to world
      const qw = new THREE.Quaternion().setFromRotationMatrix(this.want.m);
      const qh = new THREE.Quaternion().setFromRotationMatrix(this.have.m);
      this.dq.copy(qw).multiply(qh.invert());
      this.dq.premultiply(rot).multiply(rot.clone().invert());
      this.q.set(ih.quaternion.x, ih.quaternion.y, ih.quaternion.z, ih.quaternion.w).premultiply(new THREE.Quaternion().slerp(this.dq, 0.7));
      ih.quaternion.set(this.q.x, this.q.y, this.q.z, this.q.w);
    });
  }
}
