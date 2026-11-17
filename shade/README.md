# SHADE: a hand-shadow puppet theater for Meta Quest

> **Your hands cast the level.** A lantern rests in your lap and a paper screen floats in front of you.
> Raise your hands into the light and their shadows become solid ground for Kit, a small paper fox
> trying to get home.

Hands-first · seated · mixed reality · WebXR (three.js) · no controllers · no downloads

**Play:** open the deployed URL in the **Meta Quest Browser** → *Enter Mixed Reality*.
No headset? The same URL runs in a desktop browser with the mouse, and *Watch the puppeteer play* runs an autonomous demo.

---

## The idea

Shadow puppetry is one of the oldest forms of storytelling, and it has always been about hands.
SHADE turns it into a puzzle game where **the shadow is the game object**:

| Your hand does... | ...its shadow becomes |
|---|---|
| Lies flat, sideways | a **bridge** across a gap |
| Slides under Kit and rises | an **elevator** |
| Hovers above Kit | an **umbrella** against ember rain |
| Stands upright | a **wall** that turns Kit around |
| Brushes across strings | **music** (Shadow Harp free-play mode) |

Moving your hand **closer to the lantern makes the shadow bigger**, the same physics as real shadow puppetry,
so the core mechanic needs no explanation. Kit walks on its own (Lemmings-style), which makes you the
stagehand: you never steer Kit, you shape the world around it.

## Design guideline checklist

- **Hands-first, end to end:** every menu is diegetic (*hold your shadow over a card* to select),
  and the four tray tokens (Restart / Menu / Slow / Recenter) are poked with a fingertip. Controllers work as a fallback
  (each controller casts a flat-hand shadow; the grip button makes a fist).
- **Airplane-seat test:** the lantern is ~38 cm below your eyes, and all play happens within ~25 cm of it.
  The theater auto-places itself 80 cm in front of wherever you're looking; *Recenter* re-anchors it.
- **One bus stop:** a few seconds from link to play. No asset downloads (all art is procedural canvas, all audio is procedural WebAudio).
  Each level takes 10–40 s. Pause/resume follows the XR session's visibility state, and progress (stars) is saved locally.
- **Original, not a wrapper:** no third-party services. The shadow caster, physics, art, and audio are all built from scratch.
- **Accessibility:** levels I–III are fully one-handed and IV can be done one-handed (two hands make it easier). *Slow* mode halves Kit's speed and slows the embers.
  The design is high-contrast (ink-dark shadow on warm paper), all audio cues have visual equivalents, and no standing or turning is needed.

## How it works

```
XR hand joints (25/hand) ──► theater-local space ──► ShadowCaster
                                                     │  perspective-project every bone capsule + palm polygon
                                                     │  from the lantern point onto the screen plane
                                                     ▼
                                     160×100 solid-cell grid  ◄── same data ──► smooth vector shadow (Canvas2D, penumbra blur)
                                                     │
                                                     ▼
                                World sim @ 60 Hz: Kit (walk / step-up / carried / fall),
                                embers (collide with shadow), fireflies, door
```

- `src/core/`: engine-agnostic, dependency-free simulation (runs in Node):
  `shadow.js` (projection + rasterizer), `world.js` (2D physics), `game.js` (diegetic menus, harp),
  `handmodel.js` (WebXR joint layout + a procedural hand), `bot.js`/`director.js` (the AI "puppeteer").
- `src/render/`: three.js theater, paper-screen painter, hand visuals, poke tokens.
- `src/input/hands.js`: WebXR hand tracking (with jitter smoothing), controller fallback, desktop mouse hand.

### The puppeteer bot = automated QA

`npm test` runs the whole game headless: a bot drives synthetic hands, casts real shadows, and must clear every
level (normal and Slow mode), including the diegetic menu navigation and the harp. That's how level tuning was verified
without a headset in the loop. The same bot powers the in-app demo mode and the recorded trailer.

## Develop

```bash
npm install
npm run dev        # https needed on Quest: use the deployed Pages URL, or `adb reverse tcp:5173 tcp:5173`
npm test           # headless solvability test
npm run build
```

Desktop controls: mouse = hand position, wheel = nearer/farther from the lantern, `1–6` hand shapes,
`W` rotate 90°, `Q/E` tilt, `R` restart, `M` menu, `S` slow mode.

### Recording the trailer

```bash
npm run build && npx vite preview --port 4173 &
node scripts/record.mjs http://localhost:4173/?record=1 record_out
python3 scripts/soundtrack.py record_out/events.json record_out/audio.wav
ffmpeg -framerate 30 -i record_out/frames/f%05d.jpg -i record_out/audio.wav -c:v libx264 -pix_fmt yuv420p -crf 18 -c:a aac -shortest shade_demo.mp4
```

## Roadmap

- Pose-recognized **shadow creatures**: form a rabbit or a bird and it detaches from your hand and joins the story.
- **Co-op shadow theater** (shared-space MR): one player is the bridge, the other the umbrella.
- **Level editor:** cut new paper terrain with a pinch-and-tear gesture, then share it.
- **Daily shadow puzzle** with a firefly leaderboard.
