# Brain Lag

> The button is always the same. The problem is it never does the same thing.

**Brain Lag** is a one-tap endless runner through a galactic reflex gauntlet. The tap does something different every few seconds, and survival is a race against your own muscle memory.

[![Play Now](https://img.shields.io/badge/play-online-4da3ff?style=for-the-badge)](https://ppiova.github.io/brain-lag/)
[![Live Deploy](https://img.shields.io/badge/github_pages-live-22c55e?style=for-the-badge)](https://ppiova.github.io/brain-lag/)
[![License](https://img.shields.io/badge/license-MIT-green?style=for-the-badge)](LICENSE)

---

## The Hook

A single input. A single button. Four rules that cycle every few seconds in a randomized order.

- One moment, tapping makes you **jump**.
- The next, it **flips gravity**.
- Then it **dashes** you through walls.
- Then you're a **bouncing ball**, tapping for big bounces over tall obstacles.

You don't die because the game is hard. You die because your reflexes were still playing the previous rule.

That half-second of confusion? That's the lag. That's the game.

## How to Play

- **Tap anywhere** (mobile) / **Click or press `Space`** (desktop) — that's the only input
- **`P`** or **`Esc`** — pause
- **`M`** — mute
- **Gear icon** — music / SFX volumes + reduce-motion toggle
- The screen flashes with the new rule's icon and color, plus a half-second slow-mo before any obstacle appears

### The Four Rules

| Icon | Rule     | What the tap does                                               |
|:----:|----------|-----------------------------------------------------------------|
| ▲    | JUMP     | Jump (coyote time + jump buffering forgive imperfect timing)    |
| ⇅    | GRAVITY  | Flip between floor and ceiling                                  |
| ▶    | DASH     | Short invincible burst through the next obstacle                |
| ●    | BOUNCE   | Auto-rebound on every surface; tap for big bounce over tall walls |

## Modes

- **Free Play** — tap anywhere to start.
- **Daily Challenge** — gold button on the start screen. Same obstacle sequence for everyone on a given UTC day, seeded from the date.

## Scoring

Two numbers matter:

- **Time survived** — displayed live, recorded on death.
- **Max combo** — every near-miss (<14px clearance) adds to the combo. Combo resets on rule change. Best combo of the run is the brag number.

The death screen also surfaces a labeled failure mode: *Tunnel Vision · Brain Lag · Muscle Memory · Greedy · Impatient · Ship Lost*. That one-word reason is the shareable quip.

## Features

### Core gameplay
- 4 rules with smooth rotation (random next-pick, never the same twice in a row)
- 3 obstacle types: pillars, wide walls (DASH-only), moving patrol lasers
- Smooth difficulty curve — speed, density and rule-change rate scale asymptotically
- 10-second warmup on first rule, so new players can learn before the first swap
- Near-miss combo with tiered color (white → orange → red) and floating +N feedback
- Coyote time (80ms) + jump buffering (120ms) — forgiving pro-feel physics

### Game feel
- Player squash/stretch + gravity-flip rotation
- Particle bursts on every event: jumps, flips, near-misses, rule changes, death
- Screen shake with exponential decay
- Cinematic death: 120ms freeze-frame → white flash → 900ms explosion before overlay
- Player trail (saber-style ghost afterimages)
- Context-aware failure labels based on *why* you died

### Visuals
- Space-opera theme: parallax 3-layer starfield, ambient planet, glow rails
- Hyperspace-streak effect on rule changes (24 streaking lines + icon + color wash)
- Laser-gate obstacles with pulsing cores and warning stripes
- Breathing title animation on start screen
- Orbitron font, 4-color rule palette + gold for celebrations + red for lasers

### Audio
- Fully procedural Tron-inspired synthwave loop (118 BPM, Am-F-C-G)
- Layered: kick + hi-hats + detuned saw bass with filter sweep + triangle arpeggio + pad
- Dedicated SFX per action: jump, gravity flip, dash burst, near-miss ping, rule-change whoosh, death glitch, new-record chime
- Zero audio files — all synthesized via Web Audio API on first interaction

### Meta
- **Daily Challenge** (seeded, deterministic) with per-day personal best
- **Stats tracker** — total runs, total time, best combo across all sessions
- **New record celebration** — gold badge + confetti + ascending C-major bell chime
- **Share button** — native share sheet on mobile, clipboard on desktop, prompt fallback
- **Settings** — music vol, SFX vol, reduce-motion toggle (persisted)
- **Auto-pause** on tab blur / visibility change — no more dying to a Slack notification
- **First-run hint** shown exactly once (until stats.runs > 0)

### Technical
- Zero dependencies, zero build step, zero binaries in repo
- Vanilla JS + HTML5 Canvas + Web Audio API
- Deployed via GitHub Actions → Pages on every push
- Deterministic PRNG (mulberry32) for daily challenges

## Run Locally

No install, no build. Just open `index.html` in a browser, or serve the folder:

```bash
python -m http.server 8000
# or
npx serve .
```

Then open `http://localhost:8000`.

## Project Structure

```
brain-lag/
├── index.html                  # entry point + DOM
├── src/
│   ├── game.js                 # game loop, physics, rules, particles, meta
│   ├── audio.js                # procedural music + SFX
│   └── style.css               # theme + overlays + HUD
├── .github/workflows/
│   └── deploy.yml              # auto-deploy to GitHub Pages
├── DESIGN.md                   # rationale, what was built, what was cut
├── README.md
└── LICENSE
```

## Roadmap — what's next

- [ ] Rules 5+ (revisit Double Jump, Ghost — deferred from original spec)
- [ ] Server-side daily leaderboards (currently client-only)
- [ ] Haptic feedback on mobile taps
- [ ] Capacitor wrap for App Store / Play
- [ ] Weekly challenge (longer seeded ladder)
- [ ] Replay GIF export for shared deaths

## License

[MIT](LICENSE)
