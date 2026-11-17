import * as THREE from 'three';
import { NJ, BONES } from '../core/handmodel.js';

// Builds the shadow-puppet theater. All coordinates are theater-local:
// screen at z=0 centered on origin, the seated player sits at about (0, 0.05, 0.8).
export class Theater {
  constructor(cfg, screenCanvas) {
    this.cfg = cfg;
    this.root = new THREE.Group();
    this.room = new THREE.Group();
    const L = cfg.light;

    // --- paper screen
    this.screenTex = new THREE.CanvasTexture(screenCanvas);
    this.screenTex.colorSpace = THREE.SRGBColorSpace;
    this.screenTex.anisotropy = 4;
    this.screenTex.generateMipmaps = false; this.screenTex.minFilter = THREE.LinearFilter;
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(cfg.sw, cfg.sh), new THREE.MeshBasicMaterial({ map: this.screenTex, toneMapped: false }));
    this.root.add(screen);
    this.screen = screen;

    const wood = new THREE.MeshStandardMaterial({ color: 0x4a2a17, roughness: 0.75, metalness: 0.05 });
    const woodDark = new THREE.MeshStandardMaterial({ color: 0x2c170c, roughness: 0.85 });
    const gold = new THREE.MeshStandardMaterial({ color: 0xc9953a, roughness: 0.35, metalness: 0.7 });
    const box = (w, h, d, m, x, y, z) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); this.root.add(b); return b; };
    const fw = 0.05, W = cfg.sw, H = cfg.sh;
    box(W + 2 * fw, fw, 0.05, wood, 0, H / 2 + fw / 2, 0.005);
    box(W + 2 * fw, fw, 0.05, wood, 0, -H / 2 - fw / 2, 0.005);
    box(fw, H, 0.05, wood, -W / 2 - fw / 2, 0, 0.005);
    box(fw, H, 0.05, wood, W / 2 + fw / 2, 0, 0.005);
    // crest + gold trim
    box(W * 0.5, 0.06, 0.03, woodDark, 0, H / 2 + fw + 0.03, 0);
    box(W + 2 * fw + 0.02, 0.008, 0.055, gold, 0, H / 2 + fw, 0.01);
    box(W + 2 * fw + 0.02, 0.008, 0.055, gold, 0, -H / 2 - fw, 0.01);
    const crest = new THREE.Mesh(new THREE.CircleGeometry(0.035, 6), gold); crest.position.set(0, H / 2 + fw + 0.03, 0.017); this.root.add(crest);
    // stage skirt below
    box(W + 2 * fw, 0.2, 0.06, woodDark, 0, -H / 2 - fw - 0.1, 0);

    // curtains (folded planes)
    const curtainMat = new THREE.MeshStandardMaterial({ color: 0x7a0f1c, roughness: 0.9, side: THREE.DoubleSide });
    const mkCurtain = (side) => {
      const geo = new THREE.PlaneGeometry(0.22, H + 0.32, 24, 1);
      const p = geo.attributes.position;
      for (let i = 0; i < p.count; i++) { const x = p.getX(i); p.setZ(i, Math.sin(x * 120) * 0.012 + (side * x + 0.11) * 0.12); }
      geo.computeVertexNormals();
      const m = new THREE.Mesh(geo, curtainMat);
      m.position.set(side * (W / 2 + 0.15), -0.02, 0.05);
      this.root.add(m);
    };
    mkCurtain(-1); mkCurtain(1);
    const valance = new THREE.PlaneGeometry(W + 0.5, 0.11, 60, 1);
    { const p = valance.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i); p.setZ(i, Math.sin(x * 60) * 0.008); if (y < 0) p.setY(i, y - Math.abs(Math.sin(x * 9)) * 0.03); } valance.computeVertexNormals(); }
    const val = new THREE.Mesh(valance, curtainMat); val.position.set(0, H / 2 + 0.075, 0.06); this.root.add(val);

    // --- tray + lantern in your lap
    const tray = box(0.78, 0.018, 0.2, wood, 0, L[1] - 0.06, L[2] - 0.02);
    this.trayTop = L[1] - 0.06 + 0.009;
    void tray;
    const lantern = new THREE.Group();
    lantern.position.set(L[0], L[1], L[2]);
    const paperMat = new THREE.MeshStandardMaterial({ color: 0xffc070, emissive: 0xff9a30, emissiveIntensity: 1.6, roughness: 0.6, transparent: true, opacity: 0.92 });
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.03, 20, 14), paperMat); body.scale.set(1, 1.25, 1); lantern.add(body);
    const capMat = new THREE.MeshStandardMaterial({ color: 0x2a140a, roughness: 0.5 });
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.02, 0.012, 16), capMat); cap.position.y = 0.04; lantern.add(cap);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.016, 0.012, 16), capMat); base.position.y = -0.04; lantern.add(base);
    const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.012, 8), capMat); stand.position.y = -0.052; lantern.add(stand);
    this.root.add(lantern);
    this.lanternMat = paperMat;
    this.lantern = lantern;
    // halo sprite
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: radialTex('rgba(255,200,110,1)'), color: 0xffffff, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }));
    halo.scale.set(0.22, 0.22, 1); halo.position.set(...L); this.root.add(halo); this.halo = halo;
    this.light = new THREE.PointLight(0xffb060, 2.2, 3, 1.4); this.light.position.set(...L); this.root.add(this.light);
    this.root.add(new THREE.HemisphereLight(0x8a7090, 0x201010, 0.55));

    // --- light cone (soft additive frustum from lantern to screen)
    this.root.add(this._cone(L, W, H));
    this.dust = this._dust(L, W, H); this.root.add(this.dust);

    // --- room (VR only; hidden in mixed reality)
    const sky = new THREE.Mesh(new THREE.SphereGeometry(30, 32, 16), new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false,
      uniforms: {},
      vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
      fragmentShader: 'varying vec3 vP; void main(){ float h = normalize(vP).y; vec3 c = mix(vec3(0.05,0.03,0.06), vec3(0.11,0.06,0.12), smoothstep(-0.2,0.5,h)); gl_FragColor = vec4(c,1.); }',
    }));
    this.room.add(sky);
    const floor = new THREE.Mesh(new THREE.CircleGeometry(6, 48), new THREE.MeshStandardMaterial({ color: 0x1d120c, roughness: 0.95 }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = -1.15; this.room.add(floor);
    const stars = new THREE.BufferGeometry(), sp = [];
    for (let i = 0; i < 400; i++) { const a = Math.random() * Math.PI * 2, e = Math.random() * 0.9 + 0.1, r = 25; sp.push(Math.cos(a) * Math.cos(e) * r, Math.sin(e) * r, Math.sin(a) * Math.cos(e) * r); }
    stars.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
    this.room.add(new THREE.Points(stars, new THREE.PointsMaterial({ color: 0xffe6c0, size: 0.06, transparent: true, opacity: 0.6 })));
    // floating paper lanterns far away
    for (let i = 0; i < 14; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: radialTex('rgba(255,170,80,1)'), transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending }));
      const a = (i / 14) * Math.PI * 2; s.position.set(Math.cos(a) * (5 + i % 3), 0.5 + (i % 4) * 0.6, Math.sin(a) * (5 + i % 3) - 2); s.scale.set(0.4, 0.4, 1); this.room.add(s);
    }
    this.root.add(this.room);

    // --- hand visuals (ghostly bead hands)
    this.handViz = new HandViz(); this.root.add(this.handViz.group);
    this.t = 0;
  }

  _cone(L, W, H) {
    const corners = [[-W / 2, -H / 2], [W / 2, -H / 2], [W / 2, H / 2], [-W / 2, H / 2]];
    const pos = [], uv = [];
    for (let i = 0; i < 4; i++) {
      const a = corners[i], b = corners[(i + 1) % 4];
      pos.push(...L, a[0], a[1], 0.002, b[0], b[1], 0.002); uv.push(0, 0, 1, 0, 1, 1);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    const m = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      uniforms: { uL: { value: new THREE.Vector3(...L) }, uI: { value: 0.07 } },
      vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
      fragmentShader: 'uniform vec3 uL; uniform float uI; varying vec3 vP; void main(){ float d = clamp(1.0 - vP.z/uL.z, 0.0, 1.0); float a = uI * smoothstep(0.0,0.25,d) * (1.0 - 0.6*d); gl_FragColor = vec4(1.0,0.78,0.45, a); }',
    });
    this.coneMat = m;
    return new THREE.Mesh(g, m);
  }

  _dust(L, W, H) {
    const n = 160, p = new Float32Array(n * 3), seed = new Float32Array(n);
    for (let i = 0; i < n; i++) seed[i] = Math.random();
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    this._dustSeed = seed; this._dustL = L; this._dustWH = [W, H];
    return new THREE.Points(g, new THREE.PointsMaterial({ map: radialTex('rgba(255,230,180,1)'), size: 0.006, transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending }));
  }

  update(dt) {
    this.t += dt;
    const f = 0.9 + 0.06 * Math.sin(this.t * 13) + 0.04 * Math.sin(this.t * 31 + 1);
    this.light.intensity = 2.2 * f; this.lanternMat.emissiveIntensity = 1.6 * f; this.halo.material.opacity = 0.5 * f;
    const pos = this.dust.geometry.attributes.position, s = this._dustSeed, L = this._dustL, [W, H] = this._dustWH;
    for (let i = 0; i < s.length; i++) {
      const u = (s[i] * 7.3 + this.t * 0.01 * (0.5 + s[i])) % 1, v = (s[i] * 13.7 + Math.sin(this.t * 0.2 + i) * 0.05 + 1) % 1, d = ((s[i] * 3.1) % 1) * 0.9 + 0.05;
      const tx = (u - 0.5) * W, ty = (v - 0.5) * H;
      pos.setXYZ(i, L[0] + (tx - L[0]) * d, L[1] + (ty - L[1]) * d, L[2] * (1 - d));
    }
    pos.needsUpdate = true;
  }

  setPassthrough(on) { this.room.visible = !on; this.coneMat.uniforms.uI.value = on ? 0.05 : 0.07; }
}

export class HandViz {
  constructor() {
    this.group = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: 0xc89878, roughness: 0.7, emissive: 0x24100a, emissiveIntensity: 0.4 });
    this.joints = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 12, 8), mat, NJ * 2);
    const cyl = new THREE.CylinderGeometry(1, 1, 1, 10, 1, true); cyl.translate(0, 0.5, 0);
    this.bones = new THREE.InstancedMesh(cyl, mat, BONES.length * 2);
    this.palm = [0, 1].map(() => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(7 * 3 * 3), 3)); const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: 0xc08e70, roughness: 0.7, side: THREE.DoubleSide, emissive: 0x24100a, emissiveIntensity: 0.4 })); m.frustumCulled = false; this.group.add(m); return m; });
    this.joints.frustumCulled = false; this.bones.frustumCulled = false;
    this.group.add(this.joints, this.bones);
    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._a = new THREE.Vector3(); this._b = new THREE.Vector3(); this._s = new THREE.Vector3(); this._up = new THREE.Vector3(0, 1, 0);
  }
  update(hands) {
    let ji = 0, bi = 0;
    const m = this._m, a = this._a, b = this._b, s = this._s, q = this._q;
    hands.forEach((h, hi) => {
      const palm = this.palm[hi];
      if (!h || !h.valid) { palm.visible = false; return; }
      for (let i = 0; i < NJ; i++) {
        a.set(h.pos[i * 3], h.pos[i * 3 + 1], h.pos[i * 3 + 2]);
        const r = h.rad[i] * 0.95;
        m.compose(a, q.identity(), s.set(r, r, r)); this.joints.setMatrixAt(ji++, m);
      }
      for (const [ia, ib, ro] of BONES) {
        if (ro) continue;
        a.set(h.pos[ia * 3], h.pos[ia * 3 + 1], h.pos[ia * 3 + 2]); b.set(h.pos[ib * 3], h.pos[ib * 3 + 1], h.pos[ib * 3 + 2]);
        const len = a.distanceTo(b); if (len < 1e-4) continue;
        q.setFromUnitVectors(this._up, b.clone().sub(a).divideScalar(len));
        const r = Math.min(h.rad[ia], h.rad[ib]) * 0.92;
        m.compose(a, q, s.set(r, len, r)); this.bones.setMatrixAt(bi++, m);
      }
      // palm fan
      const P = [0, 1, 6, 11, 16, 21, 20], arr = palm.geometry.attributes.position;
      let k = 0;
      for (let i = 1; i < P.length - 1; i++) for (const j of [P[0], P[i], P[i + 1]]) arr.setXYZ(k++, h.pos[j * 3], h.pos[j * 3 + 1], h.pos[j * 3 + 2]);
      arr.needsUpdate = true; palm.geometry.computeVertexNormals(); palm.visible = true;
    });
    this.joints.count = ji; this.bones.count = bi;
    this.joints.instanceMatrix.needsUpdate = true; this.bones.instanceMatrix.needsUpdate = true;
  }
}

let _radial = new Map();
export function radialTex(color) {
  if (_radial.has(color)) return _radial.get(color);
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, color); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; _radial.set(color, t); return t;
}
