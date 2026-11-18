## Inspiration

Shadow puppetry might be the oldest hands-first interface there is: a light, a wall, and two hands telling a story. Almost everyone has made a shadow rabbit, and nobody needed a tutorial to do it.

When I started exploring Quest hand tracking, most of what I tried used hands as a fancier cursor: point, pinch, poke a floating button. I wanted the opposite, a game where your hands **are** the content and the experience couldn't exist without them. SHADE is built on one rule:

> **In Kit's world, shadows are solid.**

## What it does

A paper lantern rests in your lap and a small wooden theater floats in front of you, in your own room (mixed reality). Raise your hands into the light and their shadows fall on the paper screen. Kit, a little paper fox, walks on their own. You never steer Kit; you shape the world in front of them:

- a flat hand becomes a **bridge** across a gap,
- slide it under Kit and lift, and you're the **elevator**,
- hover a palm overhead and it's an **umbrella** against falling embers,
- stand a hand upright and it's a **wall** that turns Kit around.

Just like real shadow puppetry, **moving your hand closer to the lantern makes its shadow bigger**, so the core mechanic teaches itself. There are five levels that build to a two-handed finale, three fireflies per level to find, and **Shadow Harp**, a free-play instrument where every finger that crosses a string plucks a note.

Even the menus are shadow play: you pick a level by holding your shadow over a paper card until a gold ring fills. Restart, Menu, Slow mode and Recenter are wooden tokens on the lap tray that you tap with a fingertip. No controllers are needed at any point.

## How I built it

SHADE is a WebXR app built on **three.js**, so it's a single link with nothing to install. Every frame:

1. **Read the hands.** All 25 WebXR joints per hand go into the theater's local space, with light smoothing against tracking jitter.
2. **Cast the shadow.** Each bone becomes a capsule, plus a polygon for the palm. Every joint $\mathbf{p}$ is projected from the lantern $\mathbf{L}$ onto the screen plane $z = 0$:

$$
t = \frac{L_z}{L_z - p_z}, \qquad \mathbf{s} = \mathbf{L} + t\,(\mathbf{p} - \mathbf{L})
$$

   Bone radii scale by the same $t$, which gives the classic puppeteer's rule, where $D$ is the lantern-to-screen distance and $d$ is the lantern-to-hand distance:

$$
\text{shadow size} \approx \text{hand size} \times \frac{D}{d}
$$

3. **Rasterize into a $160 \times 100$ grid of solid cells.** This grid is the single source of truth: Kit's physics reads it, and the soft shadow you see is drawn from the *same* projected bones. What you see is exactly what Kit can stand on.
4. **Simulate at 60 Hz.** Kit walks, steps up small ledges, turns at walls, falls off edges and gets carried upward when a shadow rises into them. Embers fizzle against any solid cell.

All art and audio are generated in code (Canvas2D paper textures, procedural Web Audio), so there are no downloads and it starts in seconds.

**The puppeteer bot.** To tune hand puzzles without wearing a headset all day, I wrote a bot. The simulation core runs headless in Node. The bot drives synthetic hands toward goals in *shadow space* ("put the shadow's top edge at Kit's feet, then rise") by inverting the lantern projection. It became my automated QA: `npm test` plays every level in normal and slow mode, and CI won't deploy unless all of them are beaten. It also powers the in-app demo mode and drives **IWER**, Meta's WebXR emulator, where a feedback loop steers emulated Quest 3 hands so the full WebXR hand-input path runs end to end.

I used AI coding tools heavily to move fast, and focused my own effort on the design, the level tuning and verifying that everything works.

## Challenges I ran into

- **Real hands aren't flat.** Fingertips sag, so a "flat" hand's shadow has dips and lips, and Kit kept stalling at bridge edges. I made Kit able to step up small ledges and aimed bridges slightly high. The game has to forgive human hands, not demand robot precision.
- **Blocky vs. beautiful.** Drawing the coarse physics grid directly looked pixelated. Rendering the same projected capsules as smooth vectors with a blurred penumbra kept physics and visuals identical while making the shadow look real.
- **Two hands at once.** In the finale one hand lifts Kit while the other shelters them, and the lift kept pushing Kit into the umbrella, which turned them around. Designing for simultaneous hands was much harder than for one.
- **No headset in the loop.** The bot, the headless tests and the IWER emulator were how I verified the hand-tracking path without a device.

## Accomplishments that I'm proud of

- A mechanic that **only works with hands** and needs no explanation.
- **What you see is what's solid:** one grid drives both the physics and the shadow you see.
- **Fully hands-first, including menus:** shadow-dwell cards and fingertip tokens, with no laser pointers.
- **A bot that plays with hands** and proves every level can be beaten on every build.
- **Accessible by design:** levels I–IV are playable one-handed (verified by the bot), slow mode halves the speed, the visuals are high contrast, every sound has a visual cue, and everything happens seated within about 25 cm of the lantern.

## What I learned

- Hands-first design is mostly about **forgiveness**: generous step heights, dwell-to-select instead of precise pokes, and a slow mode.
- The best mechanics teach themselves. Nobody needs to be told that a hand closer to the lantern casts a bigger shadow.
- **One source of truth** removes a whole class of "it looked like it should work" bugs.
- Writing a bot that plays your game is one of the best testing investments you can make, especially in XR.

## What's next for SHADE

- **Shadow creatures:** form a rabbit or a bird and it hops off your hand into the story.
- **Co-op shadow theater** in shared-space mixed reality: one player is the bridge, the other the umbrella.
- A gesture-driven **level editor** and a **daily shadow puzzle**.
- An **on-device tuning pass** on Quest 3 and 3S for comfort and tracking jitter.
