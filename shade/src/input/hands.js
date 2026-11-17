import * as THREE from 'three';
import { JOINT_NAMES, NJ, createHand, buildSyntheticHand, basisFromEuler, POSES, blendPose } from '../core/handmodel.js';
import { handCenterFor } from '../core/shadow.js';

const v = new THREE.Vector3(), q = new THREE.Quaternion(), m3 = new THREE.Matrix4();

// Real WebXR hand tracking (with controller fallback), output in theater-local coordinates.
export class XRHands {
  constructor(renderer, scene) {
    this.renderer = renderer;
    this.src = [0, 1].map(i => { const h = renderer.xr.getHand(i); scene.add(h); return h; });
    this.grips = [0, 1].map(i => {
      const g = renderer.xr.getControllerGrip(i); scene.add(g);
      g.addEventListener('connected', e => { g.userData.src = e.data; });
      g.addEventListener('disconnected', () => { g.userData.src = null; });
      return g;
    });
    this.out = [createHand(), createHand()];
    this.smooth = [createHand(), createHand()];
    this.kind = 'none';
  }
  read(theater, session) {
    const inv = m3.copy(theater.matrixWorld).invert();
    let anyHand = false, anyCtrl = false;
    for (let i = 0; i < 2; i++) {
      const hand = this.src[i], o = this.out[i], s = this.smooth[i];
      const isrc = this.grips[i].userData.src;
      if (hand.visible && hand.joints && hand.joints['wrist'] && hand.joints['wrist'].visible) {
        anyHand = true;
        for (let j = 0; j < NJ; j++) {
          const jo = hand.joints[JOINT_NAMES[j]];
          if (!jo) continue;
          v.copy(jo.position).applyMatrix4(hand.matrixWorld).applyMatrix4(inv);
          o.pos[j * 3] = v.x; o.pos[j * 3 + 1] = v.y; o.pos[j * 3 + 2] = v.z;
          o.rad[j] = jo.jointRadius || 0.008;
        }
        o.valid = true;
      } else if (isrc && !isrc.hand && this.grips[i].visible) {
        // controller fallback: a flat synthetic hand at the grip pose
        anyCtrl = true;
        const gr = this.grips[i];
        gr.updateMatrixWorld();
        v.setFromMatrixPosition(gr.matrixWorld).applyMatrix4(inv);
        q.setFromRotationMatrix(m3.clone().multiplyMatrices(inv, gr.matrixWorld));
        const X = new THREE.Vector3(1, 0, 0).applyQuaternion(q), Y = new THREE.Vector3(0, 0, -1).applyQuaternion(q), Z = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
        const pressed = isrc.gamepad && isrc.gamepad.buttons[1] && isrc.gamepad.buttons[1].pressed;
        const P = pressed ? POSES.fist : POSES.flat;
        buildSyntheticHand(o, { center: [v.x, v.y, v.z], basis: [X.x, X.y, X.z, Y.x, Y.y, Y.z, Z.x, Z.y, Z.z], curl: P.curl, spread: P.spread, left: isrc.handedness === 'left' });
      } else o.valid = false;
      // light temporal smoothing against tracking jitter
      if (o.valid) {
        if (!s.valid) s.pos.set(o.pos);
        for (let k = 0; k < NJ * 3; k++) s.pos[k] += (o.pos[k] - s.pos[k]) * 0.6;
        s.rad.set(o.rad); s.valid = true;
      } else s.valid = false;
    }
    this.kind = anyHand ? 'hands' : anyCtrl ? 'controllers' : 'none';
    return this.smooth;
  }
}

// Desktop / browser fallback: the mouse drives a synthetic hand's shadow.
export class MouseHand {
  constructor(dom, cfg) {
    this.cfg = cfg; this.dom = dom;
    this.hand = createHand();
    this.sx = 0; this.sy = -0.1; this.t = 2.3; this.roll = 0; this.poseName = 'flat';
    this.pose = blendPose({}, POSES.flat, POSES.flat, 0);
    this.active = false;
    this.ndc = new THREE.Vector2();
    dom.addEventListener('pointermove', e => { const r = dom.getBoundingClientRect(); this.ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); this.active = true; });
    dom.addEventListener('pointerleave', () => { this.active = false; });
    dom.addEventListener('wheel', e => { this.t = Math.min(3.4, Math.max(1.5, this.t - e.deltaY * 0.001)); e.preventDefault(); }, { passive: false });
    window.addEventListener('keydown', e => {
      const map = { '1': 'flat', '2': 'open', '3': 'fist', '4': 'point', '5': 'rabbit', '6': 'cup' };
      if (map[e.key]) this.poseName = map[e.key];
      if (e.key === 'q' || e.key === 'Q') this.roll += Math.PI / 12;
      if (e.key === 'e' || e.key === 'E') this.roll -= Math.PI / 12;
      if (e.key === 'w' || e.key === 'W') this.roll = this.roll === 0 ? Math.PI / 2 : 0;
    });
  }
  update(dt, camera, theater) {
    if (!this.active) { this.hand.valid = false; return this.hand; }
    // ray from camera through the cursor onto the screen plane (theater z = 0)
    const ray = new THREE.Raycaster(); ray.setFromCamera(this.ndc, camera);
    const inv = new THREE.Matrix4().copy(theater.matrixWorld).invert();
    const o = ray.ray.origin.clone().applyMatrix4(inv), d = ray.ray.direction.clone().transformDirection(inv);
    if (Math.abs(d.z) > 1e-4) { const k = -o.z / d.z; this.sx = o.x + d.x * k; this.sy = o.y + d.y * k; }
    blendPose(this.pose, this.pose, POSES[this.poseName], 1 - Math.exp(-10 * dt));
    buildSyntheticHand(this.hand, { center: handCenterFor(this.sx, this.sy, this.t, this.cfg.light), basis: basisFromEuler(this.roll), curl: this.pose.curl, spread: this.pose.spread });
    return this.hand;
  }
}
