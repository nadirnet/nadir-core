import * as THREE from 'three';
import { INDEX_TIP } from '../core/handmodel.js';

// Physical wooden tokens on the lap tray, pressed by poking down with a fingertip.
export class Buttons {
  constructor(theater, defs) {
    this.group = new THREE.Group();
    this.items = [];
    const y = theater.trayTop, L = theater.cfg.light;
    defs.forEach((d, i) => {
      const g = new THREE.Group();
      const x = d.x, z = L[2] + (d.z ?? 0.02);
      g.position.set(x, y, z);
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.032, 0.012, 28), new THREE.MeshStandardMaterial({ color: 0x6b3a1e, roughness: 0.6 }));
      base.position.y = 0.006; g.add(base);
      const topMat = new THREE.MeshStandardMaterial({ map: labelTex(d.label, d.icon), roughness: 0.6, emissive: 0x3a1a08, emissiveIntensity: 0.0 });
      const top = new THREE.Mesh(new THREE.CircleGeometry(0.027, 28), topMat);
      top.rotation.x = -Math.PI / 2; top.position.y = 0.0125; g.add(top);
      this.group.add(g);
      this.items.push({ ...d, g, top, topMat, press: 0, cool: 0, hot: false, pos: new THREE.Vector3(x, y + 0.0125, z), pickMeshes: [base, top] });
    });
    theater.root.add(this.group);
  }
  setLabel(id, label, icon) {
    const it = this.items.find(i => i.id === id); if (!it) return;
    it.topMat.map.dispose(); it.topMat.map = labelTex(label, icon); it.topMat.needsUpdate = true;
  }
  // hands in theater-local coordinates
  update(dt, hands) {
    const fired = [];
    for (const it of this.items) {
      it.cool = Math.max(0, it.cool - dt);
      let inside = false;
      for (const h of hands) {
        if (!h || !h.valid) continue;
        const x = h.pos[INDEX_TIP * 3], y = h.pos[INDEX_TIP * 3 + 1], z = h.pos[INDEX_TIP * 3 + 2];
        const dxz = Math.hypot(x - it.pos.x, z - it.pos.z), dy = y - it.pos.y;
        if (dxz < 0.032 && dy < 0.012 && dy > -0.03) inside = true;
      }
      if (inside && !it.hot && it.cool === 0) { it.press = 1; it.cool = 0.9; fired.push(it.id); }
      it.hot = inside;
      it.press = Math.max(0, it.press - dt * 4);
      it.g.position.y = it.pos.y - 0.0125 - it.press * 0.006;
      it.topMat.emissiveIntensity = it.press * 1.2 + (inside ? 0.4 : 0);
    }
    return fired;
  }
  pick(raycaster) {
    for (const it of this.items) if (raycaster.intersectObjects(it.pickMeshes, false).length) { it.press = 1; return it.id; }
    return null;
  }
}

function labelTex(label, icon) {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#e9d2a8'; g.beginPath(); g.arc(64, 64, 64, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#7a2a20'; g.lineWidth = 6; g.beginPath(); g.arc(64, 64, 56, 0, Math.PI * 2); g.stroke();
  g.fillStyle = '#4a1a14'; g.textAlign = 'center';
  g.font = 'bold 46px Georgia, serif'; g.fillText(icon, 64, 70);
  g.font = 'bold 17px Georgia, serif'; g.fillText(label, 64, 100);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
