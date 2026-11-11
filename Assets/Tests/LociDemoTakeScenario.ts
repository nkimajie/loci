/**
 * Demo take (demo-take), not a test: plays the whole Loci story once, at a watchable pace,
 * for recording the demo video. Every step is a real SIK pinch, as in the tests.
 *   1. Start card → "Study pack": five objects drop onto the Quick route.
 *   2. Study walk: pause on each pulsing object, pinch it (animation + name), arrow moves on.
 *   3. "Quiz me" → Find-it: pause on each "Where's the …?", pinch the right place, except
 *      prompt 3, which gets a wrong place (red shake, then the right object is revealed).
 *   4. Results "4 / 5" with the missed place glowing → "New list".
 *   5. "Build my palace": five far pinches on chair, table, shelf and floor, with one
 *      too-close pinch in between (gentle shake, rejected) → "Your palace".
 *   6. "Mixed list" drops onto the custom palace, word totem included. Ends there.
 * Beats are logged as "[LociLeaf] demo t=…" so a voice-over can be timed against them.
 */

import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {
  PALACE_PLACES,
  log,
  pinch,
  pinchBuildPalace,
  pinchGuess,
  pinchPlace,
  setupAtStart,
  waitFor,
  waitForPrompt,
  wrongSpotFor,
} from "./LociLeafHelpers"

/** Pauses (ms): long enough for a viewer to read or see each moment. */
const HOLD_START = 3000
const HOLD_DROPPED = 2000
const HOLD_BEFORE_STUDY_PINCH = 1500
const HOLD_SWITCH = 2500
const HOLD_READ_PROMPT = 2200
const HOLD_RESULTS = 4500
const HOLD_BUILD_CARD = 2000
const HOLD_BETWEEN_PLACES = 1100
const HOLD_REJECT = 2000
const HOLD_PALACE_DONE = 2500
const HOLD_END = 6000
/** Find-it prompt (0-based) that gets a deliberately wrong pinch. */
const MISS_STEP = 2

@component
export class LociDemoTakeScenario extends Scenario {
  async run(): Promise<void> {
    const main = await setupAtStart()
    const t0 = getTime()
    const beat = (what: string) => log(`demo t=${(getTime() - t0).toFixed(1)}s ${what}`)

    beat("start card")
    await sleep(HOLD_START)

    // 1. Study pack drops onto the Quick route.
    beat("pinch Study pack")
    await pinch("StudyPackButton", main)
    await waitFor(() => main.phase === "study" && main.currentSpotIndex === 0, 8000, "study at spot 1", main)
    beat("all five placed")
    await sleep(HOLD_DROPPED)

    // 2. Study walk.
    for (let k = 0; k < 5; k++) {
      await waitFor(() => main.phase === "study" && main.currentSpotIndex === k, 6000, `study at spot ${k + 1}`, main)
      await sleep(HOLD_BEFORE_STUDY_PINCH)
      beat(`walk: pinch object ${k + 1}`)
      await pinch(`Spot${k + 1}_Item`, main)
      if (k < 4) await waitFor(() => main.currentSpotIndex === k + 1, 6000, `pulse to spot ${k + 2}`, main)
    }
    await waitFor(() => main.phase === "switch" && main.cardView === "switch", 8000, "Walk again / Quiz me", main)
    beat("group glow done, Quiz me card")
    await sleep(HOLD_SWITCH)

    // 3. Find-it.
    beat("pinch Quiz me")
    await pinch("QuizMeButton", main)
    for (let step = 0; step < 5; step++) {
      const target = await waitForPrompt(main, step)
      beat(`find-it ${step + 1}/5: "${main.promptText}"`)
      await sleep(HOLD_READ_PROMPT)
      const pick = step === MISS_STEP ? wrongSpotFor(main, target) : target
      const g = await pinchGuess(main, pick)
      beat(`find-it ${step + 1}/5: pinched spot ${pick + 1} → ${g.correct ? "right" : "wrong, reveal"}`)
    }

    // 4. Results.
    await waitFor(() => main.phase === "results" && main.cardView === "results", 8000, "results card", main)
    beat(`results ${main.scoreText}`)
    await sleep(HOLD_RESULTS)
    beat("pinch New list")
    await pinch("NewListButton", main)
    await waitFor(() => main.phase === "start" && main.cardView === "start", 5000, "start card", main)
    await sleep(1500)

    // 5. Build my palace, with one too-close pinch.
    beat("pinch Build my palace")
    await pinchBuildPalace(main)
    await sleep(HOLD_BUILD_CARD)
    for (let k = 0; k < PALACE_PLACES.length; k++) {
      beat(`place ${k + 1}: ${PALACE_PLACES[k].what}`)
      await pinchPlace(main, `DemoAim${k + 1}`, PALACE_PLACES[k].at)
      await sleep(HOLD_BETWEEN_PLACES)
      if (k === 1) {
        beat("too-close pinch")
        const r = await pinchPlace(main, "DemoAimTooClose", PALACE_PLACES[1].at.add(new vec3(10, 0, 6)))
        beat(`too-close pinch → ${r}: "${main.buildStatus}"`)
        await sleep(HOLD_REJECT)
      }
    }
    await waitFor(() => main.phase === "start" && main.cardView === "start" && main.palaceMode === "custom", 6000, "Your palace card", main)
    await waitFor(() => main.routeButtonLabel === "Quick route", 3000, "palace start card live", main)
    beat("Your palace")
    await sleep(HOLD_PALACE_DONE)

    // 6. Mixed list onto the custom palace.
    beat("pinch Mixed list")
    await pinch("MixedListButton", main)
    await waitFor(() => main.phase === "study" && main.currentSpotIndex === 0, 8000, "mixed list placed", main)
    beat("mixed list on your palace (word totem included)")
    await sleep(HOLD_END)
    beat("end")
  }
}
