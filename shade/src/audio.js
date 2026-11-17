// Procedural WebAudio: no asset downloads, instant cold start.
const PENTA = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33];

export class Audio {
  constructor() { this.ctx = null; this.muted = false; this.lastStep = 0; }
  start() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain(); this.master.gain.value = 0.7; this.master.connect(this.ctx.destination);
    // reverb-ish feedback delay
    const d = this.ctx.createDelay(1); d.delayTime.value = 0.27;
    const fb = this.ctx.createGain(); fb.gain.value = 0.33;
    const lp = this.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2200;
    d.connect(lp); lp.connect(fb); fb.connect(d); lp.connect(this.master);
    this.wet = d;
    this._ambience();
  }
  suspend() { this.ctx?.suspend(); }
  resume() { this.ctx?.resume(); }

  _ambience() {
    const c = this.ctx, g = c.createGain(); g.gain.value = 0.05; g.connect(this.master);
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 500; f.connect(g);
    for (const fr of [65.4, 98.0, 130.8]) { const o = c.createOscillator(); o.type = 'triangle'; o.frequency.value = fr; o.detune.value = (Math.random() - 0.5) * 8; o.connect(f); o.start(); }
    const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = 0.07; lg.gain.value = 0.02; lfo.connect(lg); lg.connect(g.gain); lfo.start();
    // sparse koto-like notes
    const tick = () => { if (!this.ctx) return; if (this.ctx.state === 'running') this.pluck(PENTA[Math.floor(Math.random() * PENTA.length)] / (Math.random() < 0.5 ? 2 : 1), 0.05); setTimeout(tick, 2200 + Math.random() * 3500); };
    setTimeout(tick, 1500);
  }

  pluck(freq, vol = 0.18) {
    const c = this.ctx; if (!c) return;
    const t = c.currentTime, g = c.createGain();
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0008, t + 1.6);
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(freq * 8, t); f.frequency.exponentialRampToValueAtTime(freq * 1.5, t + 0.6);
    for (const [m, a] of [[1, 1], [2, 0.35], [3, 0.12]]) { const o = c.createOscillator(); o.type = m === 1 ? 'triangle' : 'sine'; o.frequency.value = freq * m; const og = c.createGain(); og.gain.value = a; o.connect(og); og.connect(f); o.start(t); o.stop(t + 1.7); }
    f.connect(g); g.connect(this.master); g.connect(this.wet);
  }
  noise(dur, vol, freq, q = 1) {
    const c = this.ctx; if (!c) return;
    const t = c.currentTime, n = Math.floor(c.sampleRate * dur), b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const s = c.createBufferSource(); s.buffer = b;
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
    const g = c.createGain(); g.gain.value = vol;
    s.connect(f); f.connect(g); g.connect(this.master); s.start(t);
  }
  chord(freqs, vol = 0.12, gap = 0.09) { freqs.forEach((f, i) => setTimeout(() => this.pluck(f, vol), i * gap * 1000)); }

  onEvents(events) {
    if (!this.ctx) return;
    for (const e of events) {
      switch (e.type) {
        case 'pluck': this.pluck(e.freq, 0.22); break;
        case 'firefly': this.chord([1046.5, 1318.5], 0.08, 0.06); break;
        case 'win': this.chord([523.25, 659.25, 783.99, 1046.5], 0.14, 0.11); break;
        case 'poof': this.noise(0.35, 0.35, 900, 0.7); this.pluck(110, 0.12); break;
        case 'fizzle': if (e.onShadow && Math.random() < 0.5) this.noise(0.08, 0.06, 3200, 2); break;
        case 'wake': this.chord([392, 523.25], 0.1, 0.12); break;
        case 'turn': this.pluck(196, 0.06); break;
        case 'land': this.noise(0.06, 0.12, 300, 1); break;
        case 'select': this.chord([392, 587.33, 783.99], 0.12, 0.07); break;
        case 'hover': this.pluck(659.25, 0.05); break;
        case 'firstShadow': this.chord([261.63, 392, 523.25], 0.08, 0.15); break;
        case 'level': this.chord([196, 293.66, 392], 0.1, 0.18); break;
        case 'button': this.noise(0.04, 0.25, 1800, 3); break;
      }
    }
  }
}
