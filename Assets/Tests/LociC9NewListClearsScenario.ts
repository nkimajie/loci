/**
 * "New list" clears all spots.
 * After a Find-it round with a miss (so there is a missed glow), "New list" returns to the
 * start card with every spot empty: no objects (their geometry destroyed), no markers,
 * glows, rings or pinch targets, no prompt or name showing. "Sample list" then fills the
 * route again from scratch.
 * Setup (all pinch): SampleListButton, Spot1_Item … Spot5_Item, QuizMeButton, one round.
 * Steps under test (pinch): NewListButton, SampleListButton.
 */

import {findInteractableByName} from "Leaf.lspkg/Interactors/InteractableUtils"
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {findSceneObjectByName, sleep} from "Leaf.lspkg/Utils/common/Utils"
import {
  SAMPLE_MODELS,
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

function visualChildCounts(): number[] {
  const out: number[] = []
  for (let n = 1; n <= 5; n++) {
    const v = findSceneObjectByName(`Spot${n}_Visual`)
    out.push(v ? v.getChildrenCount() : -1)
  }
  return out
}

@component
export class LociC9NewListClearsScenario extends Scenario {
  async run(): Promise<void> {
    const main = await setupAtStart()
    await pinchSampleListAndWaitForStudy(main)
    await pinchStudyWalkToSwitch(main)
    await pinchQuizMeAndWaitForPrompt(main)
    await playFindIt(main, [2])
    log(`C9 before New list: score="${main.scoreText}" models=${j(main.placedModelIds)} glowing=${j(main.glowingSpots)} visuals=${j(visualChildCounts())}`)
    expect(j(main.placedModelIds), "route filled before New list").toBe(j(SAMPLE_MODELS))

    // Step under test 1: New list.
    await waitFor(() => !!findInteractableByName("NewListButton", undefined, true), 3000, "NewListButton enabled", main)
    await pinch("NewListButton", main)
    await waitFor(() => main.phase === "start" && main.cardView === "start", 4000, "start card after New list", main)
    await sleep(800)
    const visuals = visualChildCounts()
    log(`C9 after New list: models=${j(main.placedModelIds)} markers=${j(main.markerVisibleSpots)} revealed=${j(main.revealedObjectSpots)} glowing=${j(main.glowingSpots)} rings=${j(main.ringKinds)} pinchable=${j(main.pinchableSpots)} visuals=${j(visuals)} prompt="${main.promptText}" name="${main.nameTagText}" score="${main.scoreText}" quizRound=${main.quizRound}`)
    expect(j(main.placedModelIds), "no objects placed").toBe(j(["", "", "", "", ""]))
    expect(j(visuals), "object geometry destroyed at every spot").toBe(j([0, 0, 0, 0, 0]))
    expect(j(main.markerVisibleSpots), "no markers").toBe(j([]))
    expect(j(main.revealedObjectSpots), "no objects showing").toBe(j([]))
    expect(j(main.glowingSpots), "no glows (missed glow cleared)").toBe(j([]))
    expect(j(main.ringKinds), "no rings").toBe(j(["", "", "", "", ""]))
    expect(j(main.pinchableSpots), "no pinch targets").toBe(j([]))
    expect(main.promptText, "no prompt").toBe("")
    expect(main.nameTagText, "no name tag").toBe("")
    expect(main.scoreText, "no score").toBe("")
    expect(!!findInteractableByName("SampleListButton", undefined, true), "start card buttons live").toBe(true)

    // Step under test 2: the cleared route takes a new list.
    await pinchSampleListAndWaitForStudy(main)
    log(`C9 after new Sample list: models=${j(main.placedModelIds)} order=${j(main.placementOrder)} phase=${main.phase}`)
    expect(j(main.placedModelIds), "route refilled").toBe(j(SAMPLE_MODELS))
    expect(j(main.placementOrder), "dropped in route order again").toBe(j([0, 1, 2, 3, 4]))
    log(`C9 PASS state=${main.getStateJson()}`)
  }
}
