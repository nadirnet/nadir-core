# Devpost submission: copy/paste kit

**Submission name:** SHADE

**Tagline (≤140 chars):**
Your hands cast the level. A shadow-puppet puzzle theater where shadows are solid and your bare hands guide a paper fox home.
*(124 chars)*

**Track:** Gaming
**Division:** New Experience
**Special awards to tick, if asked:** Boldest Original Concept · Best First Five Minutes · Best Accessibility Forward Experience

**Project link:** `https://<your-github-username>.github.io/shade-vr/` (open it in the Meta Quest Browser → *Enter Mixed Reality*)
**Built with:** WebXR, three.js, JavaScript, Vite, Canvas2D, Web Audio API, WebXR Hand Input, GitHub Pages

---

## Description (~480 words)

### Inspiration
Shadow puppetry might be the oldest hands-first interface there is: a light, a screen, and your hands telling a story.
We wanted a game that could *only* exist with hand tracking, where your hands aren't a cursor pointing at the content
but **are** the content. SHADE takes one rule and builds everything on it: **in Kit's world, shadows are solid.**

### What it is
You sit down. A paper lantern rests in your lap and a small wooden theater floats in front of you, in your own room
in mixed reality. Raise your hands into the lantern light and their shadows fall on the paper screen. Kit, a little
paper fox, walks on their own. Your job is to shape the world in front of Kit:

- a flat hand becomes a **bridge** across a gap,
- slide it under Kit and lift: you're the **elevator**,
- hover a palm overhead and it's an **umbrella** against falling embers,
- stand a hand upright and it's a **wall** that turns Kit around.

As in real shadow puppetry, moving your hand **closer to the lantern makes its shadow bigger**, so the core mechanic
teaches itself. Five handcrafted levels build to a two-handed finale. Fireflies (three per level) reward replay, and
**Shadow Harp** is a free-play instrument where every finger that crosses a string plucks a note.

Even the menus are shadow play: you choose a level by **holding your shadow over a paper card**. Restart, Menu,
Slow mode, and Recenter are wooden tokens on the tray that you tap with a fingertip. No controllers at any point.

### How we built it
SHADE is WebXR built on three.js, so it's one link with no install and a few seconds from tap to play. Each frame, the
25 tracked joints of each hand are converted into bone capsules and a palm polygon, **perspective-projected from the
lantern onto the screen plane**, and rasterized into a 160×100 solid grid. That same grid drives both Kit's physics
and the soft vector shadow you see, so what you see is exactly what Kit stands on. Art and audio are 100% procedural
(no asset downloads).

The simulation core is engine-agnostic and runs headless in Node. We built an AI **"puppeteer"** that drives synthetic
hands to solve every level from shadow-space goals ("put the shadow's top edge at Kit's feet and rise"). It became our
automated QA: every build proves all levels are solvable in normal and Slow mode. The same bot powers the in-app demo
mode and recorded our trailer.

### Designed for anywhere
- **Seated, two-foot radius:** all play happens within ~25 cm of the lantern.
- **One bus stop:** a level takes 10–40 seconds, pause/resume follows headset state, and progress is saved.
- **Accessible:** levels I–IV are playable one-handed, Slow mode halves game speed, high-contrast visuals, every sound has a visual cue.

### What's next
Pose-recognized **shadow creatures** (make a rabbit and it hops off your hand into the story), **co-op shadow theater**
in shared-space MR, a gesture-driven **level editor**, and a **daily shadow puzzle**.

---

## Hand interactions (optional field)
Hand tracking is the entire game. We read all 25 WebXR joints per hand, lightly smooth them against jitter, and project every
bone as a capsule (plus the palm as a polygon) from a virtual point light onto the screen. Depth matters: moving closer to the
lantern magnifies the shadow, giving players a natural "zoom" axis. Menus use dwell-over-card shadow selection. System
actions use fingertip pokes on physical tokens. A controller fallback casts a flat-hand shadow (grip = fist).
What excites us: hands let VR borrow interaction languages people already know from childhood. Shadow puppets are
universal, and nobody needs a tutorial for them.

## Target launch date
Live now as a WebXR app. <Optional: e.g. 'Meta Horizon Store release (packaged PWA) targeted for Q1 2027' if you intend to.>

## Team
- <Your name>, <your email>: Solo developer (design, engineering, art, audio)
