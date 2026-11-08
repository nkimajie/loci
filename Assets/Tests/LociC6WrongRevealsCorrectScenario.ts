/**
 * Find-it: a wrong pinch reveals the correct spot.
 * On prompt 1, pinch a wrong (hidden) spot: that spot shakes red, then the right spot
 * briefly shows its object with an orange ring and its name, then hides again under a
 * neutral marker, and prompt 2 appears. The score stays 0 and the item is marked missed.
 * Setup (all pinch): SampleListButton, Spot1_Item … Spot5_Item, QuizMeButton.
 * Step under test (pinch): Spot{wrong}_MarkerButton.
 */

import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {
  SAMPLE_MODELS,
  j,
  log,
  pinchGuess,
  pinchQuizMeAndWaitForPrompt,
  pinchSampleListAndWaitForStudy,
  pinchStudyWalkToSwitch,
  setupAtStart,
  waitFor,
  waitForPrompt,
  wrongSpotFor,
} from "./LociLeafHelpers"

@component
export class LociC6WrongRevealsCorrectScenario extends Scenario {
  async run(): Promise<void> {
    const main = await setupAtStart()
    await pinchSampleListAndWaitForStudy(main)
    await pinchStudyWalkToSwitch(main)
    await pinchQuizMeAndWaitForPrompt(main)

    const target = await waitForPrompt(main, 0)
    const wrong = wrongSpotFor(main, target)
    const display = main.spot(target).listItem ? main.spot(target).listItem!.display : ""

    // Watch every frame from the pinch on: when each piece of feedback first shows.
    const seen: {[k: string]: number} = {}
    let wrongObjectEverShown = false
    const t0 = getTime()
    const mark = (k: string, on: boolean) => {
      if (on && seen[k] === undefined) seen[k] = getTime() - t0
    }
    let watching = true
    this.createEvent("UpdateEvent").bind(() => {
      if (!watching) return
      mark("wrongShakes", main.shakingSpots.indexOf(wrong) >= 0)
      mark("targetRevealed", main.revealedObjectSpots.indexOf(target) >= 0)
      mark("orangeRing", main.ringKinds[target] === "orange")
      mark("nameShown", main.nameTagText === display)
      if (seen.targetRevealed !== undefined) mark("targetHiddenAgain", main.revealedObjectSpots.indexOf(target) < 0)
      mark("nextPrompt", main.quizStep === 1 && main.awaitingGuess)
      if (main.revealedObjectSpots.indexOf(wrong) >= 0) wrongObjectEverShown = true
      if (main.ringKinds[target] === "green" || main.ringKinds[wrong] !== "") seen.badRing = getTime() - t0
    })

    const g = await pinchGuess(main, wrong)
    log(`C6 asked spot${target + 1} (${SAMPLE_MODELS[target]}), pinched spot${wrong + 1}: guess=${j(g)}`)
    expect(g.correct, "guess recorded as wrong").toBe(false)
    expect(g.target, "guess target").toBe(target)
    expect(g.pinched, "guess pinched").toBe(wrong)

    await waitFor(() => seen.nextPrompt !== undefined, 8000, "prompt 2 after the wrong-pinch feedback", main)
    watching = false
    await sleep(200)
    log(`C6 timeline (s after pinch): ${j(seen)} wrongObjectEverShown=${wrongObjectEverShown} score=${main.quizScore} answers=${j(main.answersGiven)} markers=${j(main.markerVisibleSpots)} revealed=${j(main.revealedObjectSpots)}`)

    expect(seen.wrongShakes !== undefined, "the pinched (wrong) spot shook red").toBe(true)
    expect(seen.targetRevealed !== undefined, "the right spot revealed its object").toBe(true)
    expect(seen.orangeRing !== undefined, "the right spot showed an orange ring").toBe(true)
    expect(seen.nameShown !== undefined, `the right spot's name "${display}" showed`).toBe(true)
    expect(seen.wrongShakes <= seen.targetRevealed, "shake comes before the reveal").toBe(true)
    expect(seen.targetHiddenAgain !== undefined, "the reveal is brief: the object hides again").toBe(true)
    expect(seen.targetHiddenAgain - seen.targetRevealed >= 0.8, `reveal held long enough to see (${(seen.targetHiddenAgain - seen.targetRevealed).toFixed(2)} s)`).toBe(true)
    expect(seen.targetHiddenAgain <= seen.nextPrompt, "object hides again before the next prompt").toBe(true)
    expect(seen.badRing === undefined, "no green ring, and no ring on the wrong spot").toBe(true)
    expect(wrongObjectEverShown, "the wrong spot's object never shows").toBe(false)
    expect(main.quizScore, "score stays 0").toBe(0)
    expect(main.answersGiven[target], "item marked missed").toBe(false)
    expect(j(main.revealedObjectSpots), "both objects hidden again for prompt 2").toBe(j([]))
    expect(j(main.markerVisibleSpots), "all 5 markers are back").toBe(j([0, 1, 2, 3, 4]))
    expect(main.quizTargetSpot, "prompt 2 asks for the next item").toBe(main.quizOrder[1])
    log(`C6 PASS state=${main.getStateJson()}`)
  }
}
