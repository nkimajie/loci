/**
 * Done criterion 4 — answering ✓ ✓ ✗ ✓ ✓ shows "4 / 5", only spot 3 glows, and
 * "Review missed" walks only spot 3.
 * Setup (all pinch): SampleListButton, Spot1_Item … Spot5_Item, QuizMeButton.
 * Steps under test (pinch): Spot{n}_MarkerButton + GotItButton/MissedButton ×5,
 * ReviewMissedButton, Spot3_Item.
 */

import {findInteractableByName} from "Leaf.lspkg/Interactors/InteractableUtils"
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {findSceneObjectByName, sleep} from "Leaf.lspkg/Utils/common/Utils"
import {
  LociMonitor,
  SAMPLE_MODELS,
  j,
  log,
  pinch,
  pinchQuizMeAndWaitForMarkers,
  pinchSampleListAndWaitForStudy,
  pinchStudyWalkToSwitch,
  setupAtStart,
  waitFor,
} from "./LociLeafHelpers"

const PATTERN = [true, true, false, true, true]

@component
export class LociC4ResultsReviewScenario extends Scenario {
  async run(): Promise<void> {
    const main = await setupAtStart()
    const mon = new LociMonitor(this, main)
    await pinchSampleListAndWaitForStudy(main)
    await pinchStudyWalkToSwitch(main)
    await pinchQuizMeAndWaitForMarkers(main)

    for (let k = 0; k < 5; k++) {
      await waitFor(() => main.phase === "quiz" && main.currentSpotIndex === k && !main.answerButtonsVisible, 4000, `quiz at marker ${k + 1}`, main)
      await sleep(400)
      await pinch(`Spot${k + 1}_MarkerButton`, main)
      await waitFor(() => main.revealedSpot === k && main.answerButtonsVisible, 3000, `spot ${k + 1} revealed with ✓/✗`, main)
      expect(main.placedModelIds[k], `spot ${k + 1} reveals ${SAMPLE_MODELS[k]}`).toBe(SAMPLE_MODELS[k])
      await sleep(500)
      await pinch(PATTERN[k] ? "GotItButton" : "MissedButton", main)
      await waitFor(() => main.answersGiven[k] === PATTERN[k], 2000, `answer ${k + 1} recorded as ${PATTERN[k] ? "✓" : "✗"}`, main)
    }

    await waitFor(() => main.phase === "results", 3000, "results after 5 answers", main)
    await sleep(500)
    const scoreObj = findSceneObjectByName("ScoreText")
    const scoreLabel = scoreObj ? (scoreObj.getComponent("Component.Text") as Text).text : "<missing>"
    log(`C4 results: scoreText="${main.scoreText}" label="${scoreLabel}" answers=${j(main.answersGiven)} missed=${j(main.missedSpots)} glowing=${j(main.glowingSpots)} card=${main.cardView}`)
    expect(main.scoreText, "score").toBe("4 / 5")
    expect(scoreLabel, "results card ScoreText label").toBe("4 / 5")
    expect(main.cardView, "results card showing").toBe("results")
    expect(j(main.answersGiven), "answers recorded").toBe(j(PATTERN))
    expect(j(main.missedSpots), "missed spots").toBe(j([2]))
    expect(j(main.glowingSpots), "only spot 3 glows").toBe(j([2]))
    expect(main.spot(2).currentGlowMode, "spot 3 glow mode").toBe("missed")

    // Review missed (card fades to a pill after 10 s; we pinch well before that).
    await waitFor(() => !!findInteractableByName("ReviewMissedButton", undefined, true), 3000, "ReviewMissedButton enabled", main)
    await pinch("ReviewMissedButton", main)
    await waitFor(() => main.phase === "study", 3000, "review walk starts", main)
    mon.resetPulseTracking()
    await sleep(300)
    log(`C4 review start: walkQueue=${j(main.walkQueue)} review=${main.isReviewWalk} current=${main.currentSpotIndex} pulsing=${j(main.pulsingSpots)} glowing=${j(main.glowingSpots)}`)
    expect(j(main.walkQueue), "review walks only spot 3").toBe(j([2]))
    expect(main.isReviewWalk, "review mode").toBe(true)
    expect(main.currentSpotIndex, "review current spot").toBe(2)
    expect(j(main.pulsingSpots), "only spot 3 pulses in review").toBe(j([2]))

    await pinch("Spot3_Item", main)
    await waitFor(() => main.phase === "groupGlow", 5000, "review walk ends after spot 3", main)
    log(`C4 review end: visited=${j(main.visitedSpots)} glowing=${j(main.glowingSpots)}`)
    expect(j(main.visitedSpots), "review visited only spot 3").toBe(j([2]))
    expect(j(main.glowingSpots), "only spot 3 glows at review end").toBe(j([2]))
    await waitFor(() => main.phase === "switch", 4000, "switch card after review", main)
    log(`C4 after review: visited=${j(main.visitedSpots)} pulsedDuringReview=${j(mon.pulsed)} maxPulsing=${mon.maxPulsing} card=${main.cardView}`)
    expect(j(main.visitedSpots), "no other spot visited").toBe(j([2]))
    expect(j(mon.pulsed), "only spot 3 pulsed during the review").toBe(j([2]))
    expect(mon.maxPulsing <= 1, "one pulse at a time").toBe(true)
    log(`C4 PASS state=${main.getStateJson()}`)
  }
}
