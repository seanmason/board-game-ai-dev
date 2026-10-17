# Pentago: Companion, Digital Play and AI Analysis

Status: Approved implementation scope; experimental until browser, rules and AI tests pass.

## Goal and release boundary

The second game runs alongside Azul in `seanmason/board-game-ai-dev`.
The existing Azul site remains at the repository root. The Pentago development
preview is served from `/pentago/` on the same GitHub Pages website.
**Do not publish any unfinished game to `seanmason/board-game-ai`.**

Prioritize:
1. Fast entry of the real physical board's complete place+twist turns.
2. Continuous, locally executed analysis with placement heatmap, candidate
   rankings, visits, outcomes, manual AI Play Best Move and persistent pause.
3. A complete digital game as a secondary feature.
4. Undo/redo, import/export, local autosave and an original, mobile-friendly UI.

No official product photos, trademark-styled artwork, or copied rulebook prose.

## Standard Pentago rules

Two players, black and white, on a 6×6 board of four rotatable 3×3 quadrants.
Players alternate placing one marble in an empty socket and rotating one
quadrant 90 degrees clockwise or anticlockwise. The rotated quadrant may differ
from the placement quadrant.

**Important printed-rule exceptions:**
- If placement alone forms five consecutive marbles of the placing color,
  the game ends *immediately*; the player need not rotate.
- Early in the game, a rotation is optional if at least one quadrant is
  neutral (empty or containing only a single marble at its center).
  A neutral quadrant's rotation does not alter the layout.
- A twist which yields five-in-a-row for both players simultaneously is a
  draw; a twist which yields only the opponent's five-in-a-row is an opponent
  win. A completely occupied board with no five-in-a-row is a draw.
- No 180-degree rotations.

The engine resolves a **whole turn** atomically. The UI can split it into
place and rotate steps while previewing the resulting position, but records
exactly one history entry after the complete turn.

For analysis, actions are (placement cell 0..35, twist quadrant 0..3,
direction ±1) or (placement cell, skip twist) when legal. Search may collapse
multiple twist choices that produce identical resulting positions but must
retain a concrete playable action for each unique outcome.

References:
- Printed Pentago instruction booklet: https://zacatrus.es/media/instrucciones/Pentago_Reglas_zacatrus.pdf
- US basic-game instruction transcription: https://ultraboardgames.com/pentago/game-rules.php
- Strong solved Pentago reference (context only; not copied): https://perfect-pentago.net/details.html

## Engineering and testing

- `pentago/core.js`: immutable transitions, legal actions, win detection,
  rigorous position validation and serialization.
- `pentago/ai.js`: two-player guided MCTS, tactical evaluation, policy
  rollouts, per-action visits/outcomes and child-subtree reuse.
- `pentago/worker.js`: browser worker; root-parallel independence,
  pause/resume without data loss and per-turn advance when compatible.
- `pentago/app.js`: physical tracking, digital manual AI, history, two-step
  place/twist UI, candidate hover, heatmap, live analysis and autosave.
- Independent rules reference and complete-game differential tests.
- Browser Playwright integration tests and reproducible AI tournaments.

Acceptance:
- Every printed-rule edge case tested (immediate win, neutral skip,
  forced 90° twist, simultaneous draw, opponent win, full board draw).
- At least 2,000 independently compared seeded complete games.
- Browser integration verifies place+twist, analysis, no autoplay, game
  history, worker pause/resume, and conditional search reuse.
- Static GitHub Pages preview includes *only* website source assets,
  alongside the unchanged Azul page.
- PR remains draft pending hands-on user acceptance.

## Notes

The static development preview is public even though it is not a finished
public release. Avoid credentials, user data or anything confidential.
Strong solving (the four-terabyte published database) is not bundled into
this application. Simulated win-share estimates are uncalibrated.
