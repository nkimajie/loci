/**
 * Done criterion 4 (v2, Find-it) — pinching the right spot for 4 items and a wrong spot
 * for the milk shows "4 / 5", only the milk's spot (spot 3) glows, and "Review missed"
 * walks only spot 3.
 * Setup (all pinch): SampleListButton, Spot1_Item … Spot5_Item, QuizMeButton.
 * Steps under test (pinch): Spot{n}_MarkerButton ×5 (wrong spot for the milk),
 * ReviewMissedButton, Spot3_Item.
 */

import {findInteractableByName} from "Leaf.lspkg/Interactors/InteractableUtils"
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {findSceneObjectByName, sleep} from "Leaf.lspkg/Utils/common/Utils"
import {
  LociMonitor,
  j,
  log,
  pinch,
  pinchQuizMeAndWaitForPrompt,
  pinchSampleListAndWaitForStudy,
  pinchStudyWalkToSwitch,
  playFindIt,
  setupAtStart,
  waitFor,
} from "./LociLeafHelpers"

const MILK_SPOT = 2

@component
export class LociC4ResultsReviewScenario extends Scenario {
  async run(): Promise<void> {
    const main = await setupAtStart()
    const mon = new LociMonitor(this, main)
    await pinchSampleListAndWaitForStudy(main)
    await pinchStudyWalkToSwitch(main)
    await pinchQuizMeAndWaitForPrompt(main)

    const prompts = await playFindIt(main, [MILK_SPOT])
    const milkPrompt = prompts.find((p) => p.target === MILK_SPOT)!
    expect(!!milkPrompt && !milkPrompt.correct && milkPrompt.pinched !== MILK_SPOT, "the milk got a wrong spot").toBe(true)
    expect(prompts.filter((p) => p.correct).length, "4 right first tries").toBe(4)

    const scoreObj = findSceneObjectByName("ScoreText")
    const scoreLabel = scoreObj ? (scoreObj.getComponent("Component.Text") as Text).text : "<missing>"
    log(`C4 results: scoreText="${main.scoreText}" label="${scoreLabel}" answers=${j(main.answersGiven)} missed=${j(main.missedSpots)} glowing=${j(main.glowingSpots)} revealed=${j(main.revealedObjectSpots)} card=${main.cardView}`)
    expect(main.scoreText, "score").toBe("4 / 5")
    expect(scoreLabel, "results card ScoreText label").toBe("4 / 5")
    expect(main.cardView, "results card showing").toBe("results")
    expect(j(main.answersGiven), "answers per spot").toBe(j([true, true, false, true, true]))
    expect(j(main.missedSpots), "missed spots").toBe(j([MILK_SPOT]))
    expect(j(main.glowingSpots), "only the milk's spot glows").toBe(j([MILK_SPOT]))
    expect(main.spot(MILK_SPOT).currentGlowMode, "spot 3 glow mode").toBe("missed")
    expect(j(main.revealedObjectSpots), "every object is back for the review").toBe(j([0, 1, 2, 3, 4]))
    expect(j(main.markerVisibleSpots), "no markers left on the results card").toBe(j([]))

    // Review missed (card fades to a pill after 10 s; we pinch well before that).
    await waitFor(() => !!findInteractableByName("ReviewMissedButton", undefined, true), 3000, "ReviewMissedButton enabled", main)
    await pinch("ReviewMissedButton", main)
    await waitFor(() => main.phase === "study", 3000, "review walk starts", main)
    mon.resetPulseTracking()
    await sleep(300)
    log(`C4 review start: walkQueue=${j(main.walkQueue)} review=${main.isReviewWalk} current=${main.currentSpotIndex} pulsing=${j(main.pulsingSpots)} glowing=${j(main.glowingSpots)}`)
    expect(j(main.walkQueue), "review walks only spot 3").toBe(j([MILK_SPOT]))
    expect(main.isReviewWalk, "review mode").toBe(true)
    expect(main.currentSpotIndex, "review current spot").toBe(MILK_SPOT)
    expect(j(main.pulsingSpots), "only spot 3 pulses in review").toBe(j([MILK_SPOT]))

    await pinch("Spot3_Item", main)
    await waitFor(() => main.phase === "groupGlow", 5000, "review walk ends after spot 3", main)
    log(`C4 review end: visited=${j(main.visitedSpots)} glowing=${j(main.glowingSpots)}`)
    expect(j(main.visitedSpots), "review visited only spot 3").toBe(j([MILK_SPOT]))
    expect(j(main.glowingSpots), "only spot 3 glows at review end").toBe(j([MILK_SPOT]))
    await waitFor(() => main.phase === "switch", 4000, "switch card after review", main)
    log(`C4 after review: visited=${j(main.visitedSpots)} pulsedDuringReview=${j(mon.pulsed)} maxPulsing=${mon.maxPulsing} card=${main.cardView}`)
    expect(j(main.visitedSpots), "no other spot visited").toBe(j([MILK_SPOT]))
    expect(j(mon.pulsed), "only spot 3 pulsed during the review").toBe(j([MILK_SPOT]))
    expect(mon.maxPulsing <= 1, "one pulse at a time").toBe(true)
    log(`C4 PASS state=${main.getStateJson()}`)
  }
}
