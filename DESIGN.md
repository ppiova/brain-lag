# Brain Lag — Design Notes

This document captures *why* the game is the way it is, what was cut, and what question each build is trying to answer. If you change the design, update this file.

---

## The Bet

One hook. One button. One rule that keeps mutating.

The entire design hinges on this: players don't die because the game is difficult — they die because their reflexes were still playing the previous rule. That half-second of cognitive lag *is* the game.

If the rule-swap mechanic isn't fun, no amount of polish, skins, or leaderboards will save it. So every decision below is in service of answering one question as fast as possible:

> **Is the rule-swap mechanic fun, or just confusing?**

---

## Constraints of the One-Button Contract

- **Single input type.** Tap (or click, or Space). No holds, no swipes, no multi-touch. If a rule would require a second input type, the rule is cut.
- **≤50ms tap-to-action latency target.** In a reflex game, lag in the code is indistinguishable from lag in the player.
- **Every rule must be readable in one frame.** If a player has to read text to understand what the tap does, the game already failed.

## Rule Signal Protocol

When the rule changes:

1. Full-screen color flash in the new rule's color.
2. Large icon pulse in the center.
3. 0.3s of time dilation (slow-mo).
4. No obstacles spawn during the signal.
5. Per-rule adaptation window after the signal before the first critical obstacle.

No words on screen during gameplay. The icon and color *are* the message.

## Why 8 Seconds Between Rule Changes

Short enough that the swap is a constant presence. Long enough that a player gets a few successful taps and feels ownership over the current rule before it shifts. This is the number most likely to be tuned after playtest — do not treat it as sacred.

## Why No Score Beyond Time (yet)

Phase 1 is asking "is it fun." Combo multipliers, near-miss rewards, and failure-mode labels are all features that *reinforce* a loop that already works. Adding them before validation risks masking the answer to the core question.

If the MVP works, the very next thing to add is the **near-miss combo** — this is where the skill ceiling lives.

---

## What Got Cut From the Original Spec (and Why)

The original spec listed nine rules. This is what stays, what waits, and what dies.

### MVP (in v1)
- **JUMP** — The bread-and-butter. If this doesn't work, nothing works.
- **GRAVITY** — Different enough from JUMP to prove the rule-swap premise with only 2 rules.

### After MVP validates
- **DASH** — Needs obstacle pass-through logic. Cheap to add once the rest is stable.
- **DOUBLE JUMP** — A JUMP variant. Adds depth once the base jump feels right.
- **BOUNCE** — Physics twist, adds variety without new systems.

### Deferred indefinitely
- **ROTATE WORLD 90°** — A separate game. Breaks the camera, the art, the mental model.
- **CHANGE DIMENSION** — Requires level geometry that doesn't exist and isn't planned.
- **GHOST / PHASE-THROUGH** — Hard to signal clearly in 0.5s. Revisit only if we need it.
- **BRAKE (hold input)** — Violates the one-button contract. Tap-and-hold is a second input type.

## Obstacle Philosophy

Two silhouettes, one color. Every obstacle must be identifiable as a threat in one frame. "Fake traps" are explicitly banned — they directly contradict the "deaths feel fair" criterion and will make playtesters blame the game, not themselves.

## The Signature Moment

The thing a player clips and sends to a friend is **the rule-change slow-mo** — a 0.3-second time dilation with a screen-filling icon and color wash. The clip tells the whole story: *something changed, and now I have to figure it out before I die.*

If the MVP ships without this moment feeling satisfying on video, go back and tune it before building anything else.

## Success Criteria for the MVP

In playtest, with 8 cold participants:

1. ≥6/8 understand what the tap does within 5 seconds.
2. ≥6/8 retry at least 3 times unprompted.
3. First-run survival is under 60 seconds.
4. Post-playtest, more participants say "one more" than "I'm done."

If these criteria fail, the idea does not work. Do not add features to mask the signal.

## What We're Deliberately Not Building

Until the MVP passes: no art pass, no sound, no mobile build, no haptics, no leaderboards, no daily challenge, no share GIF, no monetization, no tutorial, no third rule, no skins, no difficulty curve tuning.

Every one of these features has been considered and deferred on purpose. Feature deferrals are not gaps — they are decisions. If you want to add one back, update this file and explain why.
