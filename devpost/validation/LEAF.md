# LEAF validation

**13 of 13 scenarios passed** in one recorded run. The run used 129 real SIK pinches and took 455 s of test time.

| | |
|---|---|
| Run | 2026-11-09 13:06 UTC, one scenario at a time with `run_leaf_scenario` (`onDevice: false`) |
| Target | Lens Studio 5.23.2 Preview, Specs device profile |
| Test stack | Leaf 2.0.2, SpectaclesInteractionKit 0.18.0 (package 2.0.0) |
| Code | commit `f503db8` (Build my palace); the gameplay code is unchanged since |
| Machine-readable results | [`leaf-results.json`](leaf-results.json): status, duration, every pinch target, every measured value and the final Lens state for each scenario |
| Log excerpt | [`leaf-run-excerpt.log`](leaf-run-excerpt.log): LEAF results, the tests' measurement lines and the Lens's own flow log |
| Screenshot | [`../screenshots/12-leaf-run.jpg`](../screenshots/12-leaf-run.jpg) |

## How the tests drive the Lens
- **Every step under test is a real SIK pinch.** Setup steps are pinched too.
  - Buttons and objects are pinched with LEAF's simulated tracked right hand (`LeafHandInteractor`). It runs SIK's hover → select → release on the project's own `RightHandInteractor`.
  - Build-my-palace places are pinched with a LEAF far-field pointer, `DefaultLeafInteractor`. Its ray runs from the camera through a thin aim pad on the surface, the same path a mouse click or a far pinch takes. The Lens raycasts that ray against the stand-ins' colliders itself.
- **No shortcuts.** No scenario calls the Lens's action methods (`press*`, `pinchItem`, `guessSpot`). They only read its state getters.
- **One runtime change per run:** each scenario sets `gazeDwellSec = 0` on the running Lens, so that a look can't count as a pinch. The saved scene keeps 2 s.
- **Fresh state:** `run_leaf_scenario` resets the Lens before each run, so every scenario starts from the start card.

## Results

| # | Scenario | Covers | Result | Time | Pinches | What it measured |
|---|---|---|---|---|---|---|
| 1 | `loci-c1-sample-list` | Done criterion 1 | PASS | 7.1 s | 1 | One pinch on "Errands (warm-up)". The 5 models land at 0.39 / 0.92 / 1.49 / 2.03 / 2.58 s (gaps 0.53–0.57 s), in route order chair → table left → centre → right → shelf; the count steps 0→1→…→5. Study starts 3.73 s after the pinch, with only spot 1 pulsing. |
| 2 | `loci-c2-study-walk` | Done criterion 2 | PASS | 28.8 s | 7 | A pinch on a non-current object is ignored. Each real pinch moves the pulse on 1.99–2.00 s later. The arrow sits within 0.4 cm of each spot, sideways. At most one spot pulses in any frame, in order 1→5. The group glow lasts 2.01 s, then "Quiz me" appears. |
| 3 | `loci-c3-quiz-reveal` | Done criterion 3 (v2) | PASS | 32.9 s | 8 | After "Quiz me": 5 identical neutral markers, nothing pulsing, no arrow. The prompt reads "Where's the milk?" with the milk icon, "1 of 5", in seeded order [3,5,4,2,1]. The right pinch brings the milk back with a **green** ring. Prompt 2 reads "Where's the gift?", and the found spot is no longer a target. |
| 4 | `loci-c4-results-review` | Done criterion 4 (v2) | PASS | 54.3 s | 14 | Right spot for 4 items, a wrong spot for the milk. Result "4 / 5" on the card, answers [✓,✓,✗,✓,✓], missed and glowing = [spot 3] only. "Review missed" walks only spot 3 and pulses only spot 3. |
| 5 | `loci-c5-mixed-list` | Done criterion 5 | PASS | 7.1 s | 1 | "keys" → key model (plural matched). "mobile" → phone (synonym). "volcano" → exactly one Text3D reading "volcano" on a word totem at table centre; no near-miss model, and no stray text at the other spots. |
| 6 | `loci-c6-wrong-reveals-correct` | Find-it extra | PASS | 34.2 s | 8 | Asked for the milk, pinched the chair. The chair shakes red; then at +0.59 s the milk appears with an **orange** ring and its name. It hides again 1.94 s later and prompt 2 follows. The wrongly pinched spot never shows an object; score 0, milk marked missed. |
| 7 | `loci-c7-each-item-once` | Find-it extra | PASS | 46.0 s | 12 | 5 prompts, one per item and no repeats, in the seeded order [3,5,4,2,1] (not route order). Each has the right question, 3D icon and "n of 5". Result "5 / 5". |
| 8 | `loci-c8-quiz-again-resets` | Find-it extra | PASS | 67.1 s | 18 | Round 1 gives "4 / 5" (milk missed). "Quiz again" resets the score to 0 and clears answers and glow, uses the new seeded order [2,1,3,5,4] and starts at "1 of 5". Round 2 gives "5 / 5" with nothing glowing. |
| 9 | `loci-c9-new-list-clears` | Find-it extra | PASS | 54.8 s | 14 | After "New list": no models (geometry destroyed at all 5 spots), markers, glows, rings, pinch targets, prompt, name or score. "Errands" then refills the route in order. |
| 10 | `loci-c10-study-pack` | Study pack | PASS | 47.3 s | 12 | Start card, top to bottom: Study pack, Errands (warm-up), Mixed list; no "Say my list" in the preview. 18 synonyms match and "glass" stays a totem. The 5 study models drop in order. Each animation plays its signature move and settles exactly back to rest: the bubble's "?" pops out, the lens zooms +51%, the bulb's rays light up, the flask's bubbles rise and the flag's cloth waves. Find-it asks "Where's the hypothesis?" and so on; result "5 / 5". |
| 11 | `loci-c11-palace-five-spots` | Build my palace | PASS | 7.5 s | 6 | The build card reads "Pinch 5 places for your palace", "0 of 5". 5 far pinches (chair seat, table left, table right, shelf top, floor) make 5 places, each **0.00 cm** from where its ray hit the stand-in collider. They are numbered 1–5 and joined by 1, 2, 3, 4 lines. The route's 5 spots then move there, and the card reads "Your palace" / "Quick route". |
| 12 | `loci-c12-palace-too-close` | Build my palace | PASS | 10.7 s | 8 | "Quick route" cancels and restores the fixed spots. A pinch 11.7 cm from place 2 is rejected: place 2 shakes, the card says "Too close to place 2 — try 25 cm away", still "2 of 5". A far-enough pinch then becomes place 3. |
| 13 | `loci-c13-palace-quiz` | Build my palace | PASS | 57.4 s | 20 | Errands objects drop onto the 5 custom places; each object and marker sits over its place within 1 cm. The study walk and Find-it run there; missing the milk gives "4 / 5" with only its custom place glowing. "New list" keeps the palace; "Quick route" puts the fixed spots back. |

## Re-running
1. Open `loci.esproj` in Lens Studio 5.23.2.
2. Open the LEAF panel, keep "Execute on device" off, and run any `loci-c*` scenario. The `shot-*` entries are screenshot helpers, not tests: each one pinches its way to a brief moment and stops there.
3. From a coding agent, call the Lens Studio MCP tools `open_leaf_panel`, then `run_leaf_scenario` with `{"scenarioId": "loci-c4-results-review", "onDevice": false}`.
   - C8 and C13 take longer than about 60 s, which can outlast the MCP call's timeout. The scenario still finishes: look for `[loci-c8-quiz-again-resets] PASSED` in the Lens Studio log.

## Not covered by LEAF
- **Voice:** "Say my list" is on-device only.
- **World Query:** on-device surface hit-testing.
- **Real hand tracking and comfort on Specs.**
- **Spatial audio:** whether the chimes sound right.
- **Real mouse clicks in Build my palace:** injected preview taps don't reach SIK. The far pointer above follows the same camera-ray path.
