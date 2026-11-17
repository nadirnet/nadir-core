"""Render the demo soundtrack offline from the game's event log (same instrument design as src/audio.js).
usage: python3 scripts/soundtrack.py record_out/events.json record_out/audio.wav
"""
import json, sys, wave
import numpy as np

SR = 44100
src, dst = sys.argv[1], sys.argv[2]
meta = json.load(open(src))
dur = meta['frames'] / meta['fps'] + 0.5
off = meta['intro']
N = int(dur * SR)
out = np.zeros(N)
rng = np.random.default_rng(7)
PENTA = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33]


def add(sig, t, gain=1.0):
    i = int(t * SR)
    if i >= N or i < 0:
        return
    n = min(len(sig), N - i)
    out[i:i + n] += sig[:n] * gain


def pluck(f, vol=0.18, length=1.7):
    t = np.arange(int(length * SR)) / SR
    env = np.minimum(1, t / 0.005) * np.exp(-t * 3.2)
    s = (np.abs(((t * f) % 1) * 4 - 2) - 1) + 0.35 * np.sin(2 * np.pi * 2 * f * t) + 0.12 * np.sin(2 * np.pi * 3 * f * t)
    # brightness decays like the lowpass sweep
    s = s * (0.6 + 0.4 * np.exp(-t * 4))
    return s * env * vol


def noise(d, vol, center):
    n = int(d * SR)
    x = rng.standard_normal(n) * np.linspace(1, 0, n)
    # crude bandpass: difference of two one-pole lowpasses
    a1 = np.exp(-2 * np.pi * center * 1.6 / SR); a2 = np.exp(-2 * np.pi * center / 1.6 / SR)
    y1 = np.zeros(n); y2 = np.zeros(n); p1 = p2 = 0.0
    for i in range(n):
        p1 = (1 - a1) * x[i] + a1 * p1; p2 = (1 - a2) * x[i] + a2 * p2
        y1[i] = p1; y2[i] = p2
    return (y1 - y2) * vol * 3


def chord(fs, t, vol=0.12, gap=0.09):
    for k, f in enumerate(fs):
        add(pluck(f, vol), t + k * gap)


# ambient drone
tt = np.arange(N) / SR
drone = sum(np.sin(2 * np.pi * f * tt + p) for f, p in [(65.4, 0), (98.0, 1), (130.8, 2)]) / 3
drone *= 0.045 * (1 + 0.35 * np.sin(2 * np.pi * 0.07 * tt))
out += drone
t = 1.5
while t < dur:
    f = PENTA[rng.integers(len(PENTA))] / (2 if rng.random() < 0.5 else 1)
    add(pluck(f, 0.05), t)
    t += 2.2 + rng.random() * 3.5

for e in meta['events']:
    t = e['t'] + off
    ty = e['type']
    if ty == 'pluck': add(pluck(e['freq'], 0.22), t)
    elif ty == 'firefly': chord([1046.5, 1318.5], t, 0.08, 0.06)
    elif ty == 'win': chord([523.25, 659.25, 783.99, 1046.5], t, 0.14, 0.11)
    elif ty == 'poof': add(noise(0.35, 0.35, 900), t); add(pluck(110, 0.12), t)
    elif ty == 'wake': chord([392, 523.25], t, 0.1, 0.12)
    elif ty == 'turn': add(pluck(196, 0.06), t)
    elif ty == 'land': add(noise(0.06, 0.12, 300), t)
    elif ty == 'select': chord([392, 587.33, 783.99], t, 0.12, 0.07)
    elif ty == 'hover': add(pluck(659.25, 0.05), t)
    elif ty == 'firstShadow': chord([261.63, 392, 523.25], t, 0.08, 0.15)
    elif ty == 'level': chord([196, 293.66, 392], t, 0.1, 0.18)

# title + end-card swells
chord([196, 293.66, 392, 587.33], 0.3, 0.1, 0.25)
chord([261.63, 392, 523.25, 659.25, 783.99], meta['frames'] / meta['fps'] - 5.5, 0.12, 0.2)

# feedback delay "reverb"
d = int(0.27 * SR)
wet = out.copy()
for k in range(1, 6):
    wet[d * k:] += out[:-d * k] * (0.33 ** k)
mix = 0.75 * out + 0.25 * wet
# fade in/out, normalize
fade = int(0.8 * SR)
mix[:fade] *= np.linspace(0, 1, fade); mix[-fade:] *= np.linspace(1, 0, fade)
mix = mix / (np.max(np.abs(mix)) + 1e-9) * 0.85
pcm = (mix * 32767).astype(np.int16)
with wave.open(dst, 'wb') as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
print('wrote', dst, round(dur, 1), 's')
