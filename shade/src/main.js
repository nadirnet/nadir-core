import * as THREE from 'three';
import { CFG, ShadowCaster } from './core/shadow.js';
import { Game } from './core/game.js';
import { Puppeteer } from './core/bot.js';
import { Director } from './core/director.js';
import { Painter } from './render/painter.js';
import { Theater } from './render/theater.js';
import { Buttons } from './render/buttons.js';
import { XRHands, MouseHand } from './input/hands.js';
import { Audio } from './audio.js';

const params = new URLSearchParams(location.search);
const RECORD = params.has('record');
const EMU = params.has('emulate'); // run inside Meta's IWER emulator (emulated Quest 3 + hands)
let demo = params.has('demo') || RECORD;

// ---------- persistence (best-effort) ----------
const store = {
  data: { stars: {}, assist: false },
  load() { try { Object.assign(this.data, JSON.parse(localStorage.getItem('shade.v1') || '{}')); } catch { /* private mode */ } },
  save() { try { localStorage.setItem('shade.v1', JSON.stringify(this.data)); } catch { /* ignore */ } },
};
if (!RECORD) store.load();

// ---------- three ----------
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: RECORD });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.xr.enabled = true;
renderer.xr.setReferenceSpaceType('local');
renderer.xr.setFoveation(0.5);
document.getElementById('app').appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.01, 100);
const EYE = new THREE.Vector3(0, 0.07, 0.98), LOOK = new THREE.Vector3(0, -0.06, 0);
camera.position.copy(EYE); camera.lookAt(LOOK);
scene.add(camera);

const caster = new ShadowCaster(CFG);
const game = new Game(CFG, store);
const painter = new Painter(CFG);
const theater = new Theater(CFG, painter.canvas);
scene.add(theater.root);
const buttons = new Buttons(theater, [
  { id: 'restart', label: 'RESTART', icon: '↺', x: -0.33 },
  { id: 'menu', label: 'MENU', icon: '☰', x: -0.245 },
  { id: 'assist', label: store.data.assist ? 'SLOW ON' : 'SLOW', icon: '◐', x: 0.245 },
  { id: 'recenter', label: 'CENTER', icon: '◎', x: 0.33 },
]);
const audio = new Audio();
const xrHands = new XRHands(renderer, scene);
const mouse = new MouseHand(renderer.domElement, CFG);
const pup = new Puppeteer(CFG);
let director = demo ? new Director(game, pup) : null;

let mode = 'desktop'; // desktop | xr
let passthrough = false, paused = false, needsPlacement = false, placeFrames = 0;
const status = document.getElementById('status');

function act(id) {
  audio.onEvents([{ type: 'button' }]);
  if (id === 'restart') game.restart();
  else if (id === 'menu') game.toMenu();
  else if (id === 'assist') { game.setAssist(!game.assist); buttons.setLabel('assist', game.assist ? 'SLOW ON' : 'SLOW', '◐'); }
  else if (id === 'recenter') needsPlacement = true;
}

// ---------- placement: put the theater 80cm in front of a seated player ----------
const _p = new THREE.Vector3(), _d = new THREE.Vector3();
function placeTheater() {
  // three.js keeps the user camera synced to the XR head pose
  camera.updateMatrixWorld(true);
  camera.getWorldPosition(_p); camera.getWorldDirection(_d);
  const yaw = Math.atan2(-_d.x, -_d.z);
  theater.root.rotation.set(0, yaw, 0);
  const off = new THREE.Vector3(0, -0.06, -0.82).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
  theater.root.position.copy(_p).add(off);
  theater.root.updateMatrixWorld(true);
}

// ---------- XR session ----------
async function startXR(kind) {
  audio.start();
  const session = await navigator.xr.requestSession(kind, { optionalFeatures: ['hand-tracking', 'local-floor'] });
  passthrough = kind === 'immersive-ar';
  theater.setPassthrough(passthrough);
  scene.background = null;
  await renderer.xr.setSession(session);
  mode = 'xr'; needsPlacement = true; placeFrames = 0;
  if (!EMU) { demo = false; director = null; pup.releaseAll(); }
  document.body.classList.add('in-xr');
  session.addEventListener('visibilitychange', () => {
    paused = session.visibilityState !== 'visible';
    paused ? audio.suspend() : audio.resume();
  });
  session.addEventListener('end', () => {
    mode = 'desktop'; passthrough = false; theater.setPassthrough(false);
    theater.root.position.set(0, 0, 0); theater.root.rotation.set(0, 0, 0);
    document.body.classList.remove('in-xr');
    camera.position.copy(EYE); camera.lookAt(LOOK);
  });
}

// ---------- overlay ----------
async function setupOverlay() {
  const ar = navigator.xr && await navigator.xr.isSessionSupported('immersive-ar').catch(() => false);
  const vr = navigator.xr && await navigator.xr.isSessionSupported('immersive-vr').catch(() => false);
  const bAR = document.getElementById('enter-ar'), bVR = document.getElementById('enter-vr');
  bAR.hidden = !ar; bVR.hidden = !vr;
  if (!ar && !vr) document.getElementById('no-xr').hidden = false;
  bAR.onclick = () => startXR('immersive-ar').catch(err => alert('Could not start mixed reality: ' + err.message));
  bVR.onclick = () => startXR('immersive-vr').catch(err => alert('Could not start VR: ' + err.message));
  document.getElementById('play-desktop').onclick = () => { audio.start(); demo = false; director = null; pup.releaseAll(); document.body.classList.add('desktop-play'); };
  document.getElementById('watch-demo').onclick = () => { audio.start(); demo = true; game.toMenu(); director = new Director(game, pup); pup.releaseAll(); document.body.classList.add('desktop-play'); };
  document.getElementById('back').onclick = () => document.body.classList.remove('desktop-play');
}

// desktop clicks on the tray tokens + shortcuts
const raycaster = new THREE.Raycaster();
renderer.domElement.addEventListener('pointerdown', e => {
  audio.start();
  const r = renderer.domElement.getBoundingClientRect();
  raycaster.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
  const id = buttons.pick(raycaster); if (id) act(id);
});
window.addEventListener('keydown', e => {
  if (e.key === 'r' || e.key === 'R') act('restart');
  if (e.key === 'm' || e.key === 'M') act('menu');
  if (e.key === 's' || e.key === 'S') act('assist');
});
document.addEventListener('visibilitychange', () => { if (mode === 'desktop') paused = document.hidden; });
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });

// ---------- loop ----------
const clock = new THREE.Clock();
const SIM_DT = 1 / 60;
let acc = 0, tAll = 0, paintMs = 0;

function frame(dt) {
  tAll += dt;
  theater.root.updateMatrixWorld(true);
  if (mode === 'xr' && needsPlacement && ++placeFrames > 2) { placeTheater(); needsPlacement = false; }

  let hands;
  if (mode === 'xr') {
    if (EMU && director) { director.step(dt); pup.update(dt); }
    hands = xrHands.read(theater.root);
    if (EMU && emuDriver && director) emuDriver.drive(pup.out, pup.hands, xrHands, theater.root);
  }
  else if (demo && director) { director.step(dt); hands = pup.update(dt); if (director.done && !RECORD) { game.toMenu(); director = new Director(game, pup); } }
  else hands = [mouse.update(dt, camera, theater.root), null];

  if (!paused) {
    caster.cast(hands);
    acc += dt;
    while (acc >= SIM_DT) { game.step(SIM_DT, caster.grid, caster.count); acc -= SIM_DT; }
  }
  const events = game.drainEvents();
  painter.onEvents(events, game); audio.onEvents(events);
  if (RECORD) for (const e of events) eventLog.push({ t: +tAll.toFixed(3), type: e.type, freq: e.freq, stars: e.stars });
  const p0 = performance.now();
  painter.paint(game, paused ? 0 : dt, caster);
  if (!RECORD) { paintMs = paintMs * 0.97 + (performance.now() - p0) * 0.03; if (paintMs > 7 && painter.hq) { painter.hq = false; console.info('SHADE: switching to fast shadow rendering'); } }
  theater.screenTex.needsUpdate = true;

  theater.handViz.group.visible = !passthrough;
  theater.handViz.update(hands);
  for (const id of buttons.update(dt, hands)) act(id);
  theater.update(dt);

  if (mode === 'desktop' && RECORD) {
    // cinematic camera: wide (lantern + hands + screen) when a scene opens, then push in on the action
    const wide = game.mode !== 'level' || game.modeT < 3.2 || game.world?.won;
    camBlend += ((wide ? 1 : 0) - camBlend) * (1 - Math.exp(-dt * 1.4));
    camera.position.lerpVectors(EYE, WIDE_EYE, camBlend);
    camera.position.x += Math.sin(tAll * 0.13) * 0.04; camera.position.y += Math.sin(tAll * 0.09) * 0.01;
    _look.lerpVectors(LOOK, WIDE_LOOK, camBlend);
    camera.fov = 62 + camBlend * 12; camera.updateProjectionMatrix();
    camera.lookAt(_look);
  }
  if (status && mode === 'xr') status.textContent = xrHands.kind;
  renderer.render(scene, camera);
}

const eventLog = [];
let camBlend = 1; const _look = new THREE.Vector3();
const WIDE_EYE = new THREE.Vector3(0, 0.13, 1.12), WIDE_LOOK = new THREE.Vector3(0, -0.13, 0);
let emuDriver = null, emuBudget = 0, frameCount = 0;
async function boot() {
  if (EMU) {
    const { installEmulator, EmulatorDriver } = await import('./input/emulator.js');
    const device = await installEmulator();
    emuDriver = new EmulatorDriver(device);
    window.__emu = device;
    director = new Director(game, pup);
  }
  if (director) director.harpTime = 13;
  if (!RECORD) setupOverlay();
  if (RECORD) {
    window.__shade = {
      step(n = 1, dt = 1 / 30) { if (EMU) emuBudget += n; else for (let i = 0; i < n; i++) frame(dt); },
      get frames() { return frameCount; },
      get done() { return director?.done; },
      get events() { return eventLog; },
      get mode() { return game.mode; },
      get level() { return game.levelIndex; },
      get t() { return tAll; },
      get xr() { return mode === 'xr' ? xrHands.kind : 'none'; },
      snap(q = 0.9) { return renderer.domElement.toDataURL('image/jpeg', q); },
    };
  }
  if (RECORD && !EMU) { frame(1 / 30); return; }
  renderer.setAnimationLoop(() => {
    let dt = Math.min(clock.getDelta(), 0.05);
    if (RECORD) { if (emuBudget > 0) { emuBudget--; dt = 1 / 30; } else dt = 0; }
    frame(dt); if (dt > 0) frameCount++;
  });
  if (EMU && RECORD) await startXR('immersive-vr');
}
boot();
