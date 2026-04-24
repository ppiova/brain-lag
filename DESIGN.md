# Brain Lag — Design Notes

This document captures *why* the game is the way it is, what was built, what was cut, and what question each build answered. If you change the design, update this file.

---

## The Bet

One hook. One button. A rule that keeps mutating.

The entire design hinges on this: players don't die because the game is difficult — they die because their reflexes were still playing the previous rule. That half-second of cognitive lag *is* the game.

If the rule-swap mechanic isn't fun, no amount of polish, skins, or leaderboards will save it. Every decision in this codebase is in service of answering one question as fast as possible:

> **Is the rule-swap mechanic fun, or just confusing?**

## What This Build Is

This is no longer an MVP — it's a polished casual-game vertical slice. The Week-1 MVP (2 rules, no art, no audio) was built, validated internally, and then iteratively extended across 20 feature commits documented in git history.

---

## Constraints of the One-Button Contract

- **Single input type.** Tap (or click, or `Space`). No holds, no swipes, no multi-touch. If a rule would require a second input type, the rule is cut.
- **≤50ms tap-to-action latency target.** In a reflex game, lag in the code is indistinguishable from lag in the player.
- **Every rule must be readable in one frame.** If a player has to read text to understand what the tap does, the game already failed.

## Rule Signal Protocol

When the rule changes:

1. Screen wash in the new rule's color.
2. Large rule icon pulses center-screen (▲ / ⇅ / ▶ / ●).
3. 24 streaking "hyperspace" lines radiate from center.
4. 0.3s of time dilation (slow-mo).
5. Audio: saw-sweep whoosh + bell stinger.
6. **No obstacles spawn during the signal window.**
7. Per-rule adaptation window after signal before the first critical obstacle.

No words on screen during gameplay. The icon and color *are* the message.

## Rules — Built vs. Deferred

### Built (4 rules)
- **JUMP** — tap to jump. Coyote time + jump buffering. Color: saber blue.
- **GRAVITY** — flip between floor and ceiling. Color: saber purple.
- **DASH** — 280ms invincible burst. 450ms cooldown prevents spam. Obstacles include wall-sized gates that *require* the dash. Color: orange.
- **BOUNCE** — auto-rebound on every surface. Tap queues a big bounce (clears tall walls). Color: mint green.

### Deferred (original 9-rule spec)
- **Double Jump** — a JUMP variant; design question is whether it's distinct enough.
- **Rotate World 90°** — scope bomb, breaks camera and art direction.
- **Dimension Swap** — requires level geometry that doesn't exist.
- **Ghost / Phase-Through** — hard to signal in 0.5s; revisit only if needed.
- **Brake (hold)** — violates the one-button contract (tap ≠ hold).

## Obstacle Types

- **PILLAR** (baseline) — solid rect on floor (or ceiling during GRAVITY).
- **WIDE_WALL** (DASH rule, ~55% of that rule's spawns) — too tall to jump over, forcing a dash. Warning stripes make the visual read "Imperial wall" at a glance.
- **MOVING_LASER** (JUMP + GRAVITY rules, ~18%) — thin patrol beam moving vertically at 70–120 px/s with a tracer trail.

BOUNCE rule uses pillars only, split ~55% short (auto-clear) / ~45% tall (require tap-boosted big bounce).

## Difficulty Curve

`difficulty(t) = 1 - exp(-t / 45)`

- 0 at t=0 → ~0.63 at 45s → ~0.86 at 90s → ~0.98 at 3min
- 10s warmup before first rule swap (so new players survive past the first shock)
- Speed scales 260 → 460 px/s
- Spawn gap scales 1.3s → 0.7s
- Rule interval scales 9s → 5s

The curve is asymptotic rather than linear so runs always feel harder but never ramp off a cliff.

## Scoring & Combo

Primary score: **time survived**.
Secondary (brag) score: **max combo**.

Combo rules:
- +1 for each obstacle passed with <14px vertical clearance
- Combo tier color tiers: white → orange (≥5) → red-hot (≥10)
- Floating "+N" text at the point of pass
- Combo **resets on every rule change** — keeps adaptation windows stakes-heavy

Why both? Time is survival. Combo is skill. A 20-second run with x15 is more respectable than a 40-second safe-play with x1. Both appear on the death screen and in the share text.

## Cinematic Death

Deaths read as a beat, not a cut:

1. **120ms freeze-frame** — hard stop. Non-skippable. The eye needs this to process impact.
2. **White flash** at full alpha, fading over ~500ms.
3. **900ms cinematic window** — explosion expands (64 rule-color + 24 laser-red + 18 white spark particles), heavy shake.
4. Death overlay slides in with context-aware failure label + new-record badge if applicable.

Impatient players can tap after the freeze to skip to retry. The freeze itself is sacred.

## Failure Modes (context-aware death labels)

Priority-ordered detection in `pickFailureMode()`:
1. **Tunnel Vision** (t < 2s): "Your first two seconds? Gone."
2. **Brain Lag** (died during rule-change signal): "Still running the old protocol."
3. **Muscle Memory** (died within 1.5s of new rule): "Old reflex. New rule."
4. **Greedy** (died with combo ≥ 5): "Died chasing a x17 combo." (dynamic)
5. **Impatient** (died in DASH rule with cooldown active): "Dash wasn't ready."
6. **Ship Lost** (default fallback): "Reflexes fell out of hyperspace."

These quips are what gets screenshotted. Generic "you died" is forgettable; *Greedy. Died chasing a x17 combo.* is a story.

## Meta Systems

### Stats (persistent, localStorage key `brainlag_stats`)
- Total runs
- Total time in hyperspace
- Best combo across all sessions
- Per-failure-mode death counts (for future stats panel)

Displayed as a quiet subtitle on the start overlay. Hidden on first visit to keep the title clean.

### Daily Challenge (key `brainlag_daily`)
- PRNG seed = UTC date as YYYYMMDD integer
- Same obstacle sequence for every player on a given day
- Per-day personal best (time + combo)
- Auto-resets when the date rolls over
- Gold button on start screen with today's key + today's best

The bet: tomorrow you come back to see how you compare on a fresh layout. Same obstacles, new execution. Low-cost retention loop without push notifications.

### Settings
- Music volume (0-100) — ramps `musicBus.gain` to `v * 0.55` in 120ms
- SFX volume (0-100) — ramps `sfxBus.gain` to `v * 0.8` in 120ms
- Reduce Motion — disables screen shake, shrinks particle bursts to 30%

### New Record Celebration
Triggers on `state.time > oldBest && state.time >= 5`:
- Gold "NEW RECORD" badge pulses on death overlay
- 64 gold confetti particles burst upward
- Ascending C-major arpeggio stinger (C5 → E5 → G5 → C6) with octave-up bell harmonics

### Share
Native `navigator.share` → clipboard fallback → `prompt()` last resort.

Format:
```
Brain Lag · DAILY 2026-04-24 — 43.2s · x17 combo · Greedy.
https://ppiova.github.io/brain-lag/
```

The failure-mode quip in the share text is what makes it worth posting.

## Audio Design (all procedural, zero binaries)

### Music loop — 118 BPM, Am-F-C-G, 2-second bars
- **Kick** — sine with frequency sweep 140 → 38 Hz + triangle click transient, on every beat
- **Hi-hats** — filtered white noise bursts on off-beats + 16th ghost notes
- **Bass** — detuned saw+square through filter sweep 220 → 1600 → 300 Hz
- **Arpeggio** — triangle wave, 8 notes per bar through chord tones
- **Pad** — 2-saw detuned by 0.7%, filter breathe on each bar

### SFX
- **Jump** — 480 → 920 Hz triangle sweep
- **Gravity flip** — 220 → 120 Hz saw through bandpass
- **Dash** — 1200 → 260 Hz saw + 120 → 50 Hz sub-boom
- **Near-miss** — 2200 → 2800 Hz sine ping
- **Rule change** — 90 → 1800 Hz saw sweep through bandpass + 1200 Hz bell 450ms later
- **Death** — 4 descending square bursts + 180 → 40 Hz sine sub-drop
- **New record** — C5-E5-G5-C6 triangle arpeggio with octave-up sine bells

## Tech Stack

- HTML5 Canvas + Vanilla JavaScript + Web Audio API
- No framework, no build step, no dependencies, no binaries
- ~800 lines of JS, ~400 lines of CSS, one HTML file
- GitHub Actions auto-deploy on push to `main`

This stack was chosen deliberately: the goal was to iterate the core loop in hours, not configure a toolchain in days. It also means the game ships in a single `git push` and runs anywhere a browser runs.

## Trademark note

The visual theme is Star Wars-*inspired* (space opera — parallax stars, saber-colored palette, laser-gate obstacles, hyperspace streaks, Orbitron font). No trademarked names, characters, logos, or music are used. Everything in the repo is original or procedurally generated. This avoids IP exposure if the game ever gets traction.

## What's NOT in this build (deliberately deferred)

- Server infrastructure / backend
- Global leaderboards (only local bests)
- Account system
- Mobile native build (Capacitor wrap)
- Haptic feedback
- Monetization (ads, skins, pass)
- Tutorial screen (the icon + color IS the tutorial)
- Dimension swap, Rotate World, Ghost, Double Jump, Brake rules
- Level editor, multiplayer, story mode, Steam version

Each of these was considered. Each has its own failure mode — server costs, platform-review time, scope explosion, gameplay violation. They stay deferred until the single-player loop proves out in the wild.

## Success Criteria

In a cold playtest with 8 participants:

1. ≥6/8 understand what the tap does within 5 seconds.
2. ≥6/8 retry at least 3 times unprompted.
3. First-run survival is under 60 seconds.
4. Post-playtest, more participants say "one more" than "I'm done."

If these criteria fail, the idea does not work. Do not add features to mask the signal.

As of this writing, the build has not yet been playtest-validated — it was iterated in a single autonomous session. The next real work is cold testing and tuning based on the results.
