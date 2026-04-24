# Brain Lag

> The button is always the same. The problem is it never does the same thing.

**Brain Lag** is a one-tap endless runner where the action of your only button changes every few seconds. Survive as long as you can while your brain tries to catch up.

[![Play Now](https://img.shields.io/badge/play-online-4da3ff?style=for-the-badge)](https://ppiova.github.io/brain-lag/)
[![Status](https://img.shields.io/badge/status-MVP-orange?style=for-the-badge)](#status)
[![License](https://img.shields.io/badge/license-MIT-green?style=for-the-badge)](LICENSE)

---

## The Hook

A single input. A single button. A rule that mutates every 8 seconds.

- One moment, tapping makes you jump.
- The next, it flips gravity.
- Soon after, it's something else entirely.

You don't die because the game is hard. You die because your reflexes were still playing the previous rule.

That half-second of confusion? That's the lag. That's the game.

## How to Play

- **Tap anywhere** (mobile) / **Click or Space** (desktop)
- That's it. No other controls.
- Watch the rule indicator at the top — the icon tells you what the tap does right now.
- The screen flashes and slows down for a moment when the rule changes. Use that window to adapt.

### Rules in the MVP

| Icon | Rule     | What the tap does                              |
|:----:|----------|------------------------------------------------|
| ▲    | JUMP     | Jump up (only when grounded)                   |
| ⇅    | GRAVITY  | Flip gravity between floor and ceiling         |

More rules (Dash, Double Jump, Bounce, Ghost) come after the MVP proves the loop is fun.

## Status

This is the **Week-1 MVP**: the smallest possible build that can answer one question — *does the rule-swap mechanic feel fun, or just confusing?*

**Explicitly cut from v1:** art pass, sound, leaderboards, daily challenge, share GIF, mobile haptics, monetization, tutorial, third rule.

**Success criteria:**
- A new player understands the controls in under 5 seconds.
- The first run lasts less than 60 seconds.
- The player immediately taps to retry.
- Deaths feel fair, not random.

If it fails these, no amount of polish will save it.

## Tech Stack

- **HTML5 Canvas** + **Vanilla JavaScript** — no frameworks, no build step, no dependencies.
- Deploys as static files.
- Runs anywhere a browser runs.

This stack was chosen on purpose. The goal is to iterate the core loop in hours, not configure a toolchain in days.

## Run Locally

No install, no build. Just open `index.html` in a browser, or serve the folder:

```bash
# with python
python -m http.server 8000

# with node
npx serve .
```

Then open `http://localhost:8000`.

## Project Structure

```
brain-lag/
├── index.html              # entry point
├── src/
│   ├── game.js             # core game loop, physics, rules
│   └── style.css           # minimal page styling
├── .github/workflows/
│   └── deploy.yml          # auto-deploy to GitHub Pages
├── README.md
└── LICENSE
```

## Roadmap

### Phase 1 — Validation (this MVP)
- [x] Auto-running character
- [x] Single-tap input
- [x] Two rules: JUMP, GRAVITY
- [x] Rule change with signal (slow-mo + flash)
- [x] Floor + ceiling obstacles
- [x] Score by survival time
- [x] Instant retry

### Phase 2 — If MVP validates
- [ ] Third rule: DASH
- [ ] Near-miss combo multiplier
- [ ] Sound design (one stinger per rule)
- [ ] Failure-mode labels on death ("Brain lag", "Muscle memory", "Greedy")
- [ ] Per-rule color polish
- [ ] Mobile build + haptics

### Phase 3
- [ ] Share GIF of final seconds
- [ ] Local best-score persistence
- [ ] Difficulty scaling
- [ ] Rules 4–5 (Double Jump, Bounce)

### Phase 4
- [ ] Daily challenge (seeded runs)
- [ ] Leaderboards
- [ ] Monetization (rewarded-ad continues)

## Design Notes

See [DESIGN.md](DESIGN.md) for the full design rationale, what got cut, and why.

## License

[MIT](LICENSE)
