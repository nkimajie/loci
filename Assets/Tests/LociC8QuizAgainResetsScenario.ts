/**
 * Find-it: "Quiz again" resets the score.
 * Round 1 misses the milk ("4 / 5", spot 3 glows). "Quiz again" hides every object again
 * behind neutral markers, clears the score, answers and missed glow, starts a new seeded
 * order at "1 of 5"; round 2 finding everything ends at "5 / 5" with nothing glowing.
 * Setup (all pinch): SampleListButton, Spot1_Item … Spot5_Item, QuizMeButton, round 1.
 * Steps under test (pinch): QuizAgainButton, Spot{answer}_MarkerButton ×5.
 */

import {findInteractableByName} from "Leaf.lspkg/Interactors/InteractableUtils"
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {quizRoundSeed, seededShuffle} from "../Scripts/LociState"
import {
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
export class LociC8QuizAgainResetsScenario extends Scenario {
  async run(): Promise<void> {
    const main = await setupAtStart()
    await pinchSampleListAndWaitForStudy(main)
    await pinchStudyWalkToSwitch(main)
    await pinchQuizMeAndWaitForPrompt(main)

    await playFindIt(main, [MILK_SPOT])
    log(`C8 round 1: score="${main.scoreText}" missed=${j(main.missedSpots)} glowing=${j(main.glowingSpots)} round=${main.quizRound}`)
    expect(main.scoreText, "round 1 score").toBe("4 / 5")
    expect(j(main.glowingSpots), "round 1: milk glows").toBe(j([MILK_SPOT]))

    // Step under test: Quiz again.
    await waitFor(() => !!findInteractableByName("QuizAgainButton", undefined, true), 3000, "QuizAgainButton enabled", main)
    await pinch("QuizAgainButton", main)
    await waitFor(() => main.phase === "quiz" && main.awaitingGuess && main.quizStep === 0, 6000, "round 2 prompt 1", main)
    await sleep(400)
    const glowModes = [0, 1, 2, 3, 4].map((i) => main.spot(i).currentGlowMode)
    const expectedOrder = seededShuffle(5, quizRoundSeed(main.quizSeed, 1))
    log(`C8 after Quiz again: score=${main.quizScore} answers=${j(main.answersGiven)} asked=${j(main.askedSpots)} step=${main.quizStep} round=${main.quizRound} order=${j(main.quizOrder.map((i) => i + 1))} markers=${j(main.markerVisibleSpots)} revealed=${j(main.revealedObjectSpots)} glow=${j(glowModes)} progress="${main.promptProgress}" scoreText="${main.scoreText}" card=${main.cardView}`)
    expect(main.quizScore, "score reset to 0").toBe(0)
    expect(j(main.answersGiven), "answers cleared").toBe(j([null, null, null, null, null]))
    expect(j(main.missedSpots), "missed list cleared").toBe(j([]))
    expect(main.quizStep, "back to the first prompt").toBe(0)
    expect(main.promptProgress, "progress restarts").toBe("1 of 5")
    expect(j(main.askedSpots), "only the new first item asked so far").toBe(j([main.quizOrder[0]]))
    expect(main.quizRound, "second round").toBe(2)
    expect(j(main.quizOrder), "round 2 uses its own seeded order").toBe(j(expectedOrder))
    expect(main.scoreText, "no score shown mid-quiz").toBe("")
    expect(main.cardView, "prompt card").toBe("prompt")
    expect(j(main.markerVisibleSpots), "all 5 markers back").toBe(j([0, 1, 2, 3, 4]))
    expect(j(main.revealedObjectSpots), "all objects hidden again").toBe(j([]))
    expect(j(glowModes), "missed glow replaced by neutral glow").toBe(j(["neutral", "neutral", "neutral", "neutral", "neutral"]))

    const prompts = await playFindIt(main, [])
    log(`C8 round 2: score="${main.scoreText}" missed=${j(main.missedSpots)} glowing=${j(main.glowingSpots)} asked=${j(prompts.map((p) => p.target + 1))}`)
    expect(main.scoreText, "round 2 counts only its own answers").toBe("5 / 5")
    expect(j(main.missedSpots), "round 2: nothing missed").toBe(j([]))
    expect(j(main.glowingSpots), "round 2: nothing glows").toBe(j([]))
    log(`C8 PASS state=${main.getStateJson()}`)
  }
}
