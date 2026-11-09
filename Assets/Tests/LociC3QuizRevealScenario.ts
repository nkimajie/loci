/**
 * Done criterion 3 (v2, Find-it) — "Quiz me" makes all 5 objects vanish behind identical
 * neutral glowing markers (nothing pulses, no arrow), and a prompt card asks
 * "Where's the <item>?" with a small 3D icon of that item, in the seeded shuffled order.
 * Pinching the right spot brings its object back with a green ring and moves to the
 * next prompt; the found spot is no longer a candidate.
 * Setup (all pinch): ErrandsButton, Spot1_Item … Spot5_Item.
 * Steps under test (pinch): QuizMeButton, Spot{answer}_MarkerButton.
 */

import {findInteractableByName} from "Leaf.lspkg/Interactors/InteractableUtils"
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {quizRoundSeed, seededShuffle} from "../Scripts/LociState"
import {
  ERRANDS_MODELS,
  ERRANDS_QUESTIONS,
  j,
  log,
  pinch,
  pinchGuess,
  pinchErrandsAndWaitForStudy,
  pinchStudyWalkToSwitch,
  setupAtStart,
  waitFor,
  waitForPrompt,
} from "./LociLeafHelpers"

@component
export class LociC3QuizRevealScenario extends Scenario {
  async run(): Promise<void> {
    const main = await setupAtStart()
    await pinchErrandsAndWaitForStudy(main)
    await pinchStudyWalkToSwitch(main)

    // Step under test 1: Quiz me.
    await pinch("QuizMeButton", main)
    await waitFor(() => main.phase === "quiz" && main.awaitingGuess, 6000, "Find-it prompt after Quiz me", main)
    await sleep(500)
    const order = main.quizOrder
    const expectedOrder = seededShuffle(5, quizRoundSeed(main.quizSeed, 0))
    const glowModes = [0, 1, 2, 3, 4].map((i) => main.spot(i).currentGlowMode)
    log(`C3 after Quiz me: order=${j(order.map((i) => i + 1))} markers=${j(main.markerVisibleSpots)} revealed=${j(main.revealedObjectSpots)} glow=${j(glowModes)} pulsing=${j(main.pulsingSpots)} arrow=${main.guide.isVisible} card=${main.cardView} prompt="${main.promptText}" icon=${main.promptIconModelId} progress="${main.promptProgress}"`)
    expect(j(main.markerVisibleSpots), "all 5 spots show a marker").toBe(j([0, 1, 2, 3, 4]))
    expect(j(main.revealedObjectSpots), "all 5 objects vanished").toBe(j([]))
    expect(j(glowModes), "every spot glows the same neutral colour").toBe(j(["neutral", "neutral", "neutral", "neutral", "neutral"]))
    expect(j(main.pulsingSpots), "no spot pulses (nothing gives the answer away)").toBe(j([]))
    expect(main.guide.isVisible, "no route arrow during Find-it").toBe(false)
    expect(main.cardView, "prompt card showing").toBe("prompt")
    expect(j(order.slice().sort()), "prompt order covers every item once").toBe(j([0, 1, 2, 3, 4]))
    expect(j(order), "prompt order is the seeded shuffle").toBe(j(expectedOrder))
    expect(j(order) !== j([0, 1, 2, 3, 4]), "prompt order is not plain route order").toBe(true)
    for (let n = 1; n <= 5; n++) {
      expect(!!findInteractableByName(`Spot${n}_MarkerButton`, undefined, true), `Spot${n}_MarkerButton enabled`).toBe(true)
    }

    const t0 = order[0]
    expect(main.quizTargetSpot, "prompt 1 asks for the first item in the order").toBe(t0)
    expect(main.promptText, "prompt 1 question").toBe(ERRANDS_QUESTIONS[t0])
    expect(main.promptIconModelId, "prompt 1 icon is the item's model").toBe(ERRANDS_MODELS[t0])
    expect(main.promptProgress, "prompt 1 progress").toBe("1 of 5")

    // Step under test 2: pinch the right spot.
    const g = await pinchGuess(main, t0)
    await sleep(300)
    log(`C3 after right pinch: guess=${j(g)} revealed=${j(main.revealedObjectSpots)} rings=${j(main.ringKinds)} nameTag="${main.nameTagText}" score=${main.quizScore} markers=${j(main.markerVisibleSpots)} glow=${main.spot(t0).currentGlowMode}`)
    expect(g.correct, "guess recorded as correct").toBe(true)
    expect(j(main.revealedObjectSpots), "only the found object popped back").toBe(j([t0]))
    expect(main.placedModelIds[t0], "the found spot shows its model").toBe(ERRANDS_MODELS[t0])
    expect(main.ringKinds[t0], "green ring on the found spot").toBe("green")
    expect(main.quizScore, "score counts the correct first try").toBe(1)
    expect(main.answersGiven[t0], "answer stored for that spot").toBe(true)
    expect(main.markerVisibleSpots.indexOf(t0) < 0, "found spot's marker is gone").toBe(true)
    expect(main.markerVisibleSpots.length, "the other 4 markers remain").toBe(4)

    // Next prompt: a new item; the found spot is no longer a candidate.
    const t1 = await waitForPrompt(main, 1)
    log(`C3 prompt 2: target=spot${t1 + 1} prompt="${main.promptText}" icon=${main.promptIconModelId} pinchable=${j(main.pinchableSpots)} revealed=${j(main.revealedObjectSpots)}`)
    expect(t1, "prompt 2 asks for the second item in the order").toBe(order[1])
    expect(main.promptText, "prompt 2 question").toBe(ERRANDS_QUESTIONS[t1])
    expect(main.promptIconModelId, "prompt 2 icon").toBe(ERRANDS_MODELS[t1])
    expect(main.promptProgress, "prompt 2 progress").toBe("2 of 5")
    expect(main.pinchableSpots.indexOf(t0) < 0, "found spot is not a guess target any more").toBe(true)
    expect(j(main.revealedObjectSpots), "found object stays in place").toBe(j([t0]))
    log(`C3 PASS state=${main.getStateJson()}`)
  }
}
