/**
 * Find-it: each item is asked exactly once, in the deterministic seeded order.
 * Plays a full round finding every item first time and checks the 5 prompts: one per
 * item, no repeats, in the seeded shuffle (not route order), each with that item's
 * question, 3D icon and "n of 5" progress; ends at "5 / 5" with nothing glowing.
 * Setup (all pinch): ErrandsButton, Spot1_Item … Spot5_Item, QuizMeButton.
 * Steps under test (pinch): Spot{answer}_MarkerButton ×5.
 */

import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {quizRoundSeed, seededShuffle} from "../Scripts/LociState"
import {
  ERRANDS_MODELS,
  ERRANDS_QUESTIONS,
  j,
  log,
  pinchQuizMeAndWaitForPrompt,
  pinchErrandsAndWaitForStudy,
  pinchStudyWalkToSwitch,
  playFindIt,
  setupAtStart,
} from "./LociLeafHelpers"

@component
export class LociC7EachItemOnceScenario extends Scenario {
  async run(): Promise<void> {
    const main = await setupAtStart()
    await pinchErrandsAndWaitForStudy(main)
    await pinchStudyWalkToSwitch(main)
    await pinchQuizMeAndWaitForPrompt(main)

    const expectedOrder = seededShuffle(5, quizRoundSeed(main.quizSeed, 0))
    const prompts = await playFindIt(main, [])
    const asked = prompts.map((p) => p.target)
    log(`C7 asked=${j(asked.map((i) => i + 1))} expected=${j(expectedOrder.map((i) => i + 1))} questions=${j(prompts.map((p) => p.question))} icons=${j(prompts.map((p) => p.icon))} progress=${j(prompts.map((p) => p.progress))} askedSpots=${j(main.askedSpots)} score="${main.scoreText}"`)

    expect(prompts.length, "5 prompts").toBe(5)
    expect(j(asked.slice().sort()), "every item asked").toBe(j([0, 1, 2, 3, 4]))
    expect(new Set(asked).size, "no item asked twice").toBe(5)
    expect(j(main.askedSpots), "Lens's own record of asked spots matches").toBe(j(asked))
    expect(j(asked), "asked in the seeded shuffled order").toBe(j(expectedOrder))
    expect(j(asked) !== j([0, 1, 2, 3, 4]), "not plain route order").toBe(true)
    prompts.forEach((p, k) => {
      expect(p.question, `prompt ${k + 1} question`).toBe(ERRANDS_QUESTIONS[p.target])
      expect(p.icon, `prompt ${k + 1} icon`).toBe(ERRANDS_MODELS[p.target])
      expect(p.progress, `prompt ${k + 1} progress`).toBe(`${k + 1} of 5`)
      expect(p.correct, `prompt ${k + 1} found first time`).toBe(true)
    })
    expect(new Set(prompts.map((p) => p.question)).size, "5 different questions").toBe(5)
    expect(main.scoreText, "all found").toBe("5 / 5")
    expect(j(main.glowingSpots), "nothing missed, nothing glows").toBe(j([]))
    log(`C7 PASS state=${main.getStateJson()}`)
  }
}
