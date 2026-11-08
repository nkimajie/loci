/**
 * Done criterion 3 — "Quiz me" turns all 5 into "?" markers, and pinching a marker
 * reveals the correct item plus ✓ / ✗.
 * Setup (all pinch): SampleListButton, Spot1_Item … Spot5_Item.
 * Steps under test (pinch): QuizMeButton, Spot1_MarkerButton.
 * Leaves the Lens showing ✓ / ✗ at spot 1 (for the review screenshot).
 */

import {findInteractableByName, isEnabled} from "Leaf.lspkg/Interactors/InteractableUtils"
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {findSceneObjectByName, sleep} from "Leaf.lspkg/Utils/common/Utils"
import {j, log, pinch, pinchSampleListAndWaitForStudy, pinchStudyWalkToSwitch, setupAtStart, waitFor} from "./LociLeafHelpers"

@component
export class LociC3QuizRevealScenario extends Scenario {
  async run(): Promise<void> {
    const main = await setupAtStart()
    await pinchSampleListAndWaitForStudy(main)
    await pinchStudyWalkToSwitch(main)

    // Step under test 1: Quiz me.
    await pinch("QuizMeButton", main)
    await waitFor(() => main.phase === "quiz", 5000, "quiz phase after Quiz me", main)
    await waitFor(() => j(main.markerVisibleSpots) === j([0, 1, 2, 3, 4]), 3000, "all 5 markers visible", main)
    await sleep(500)
    expect(j(main.markerVisibleSpots), "all 5 spots show a ? marker").toBe(j([0, 1, 2, 3, 4]))
    expect(j(main.revealedObjectSpots), "objects hidden behind markers").toBe(j([]))
    expect(j(main.pulsingSpots), "only marker 1 pulses").toBe(j([0]))
    expect(main.cardView, "card hidden during quiz").toBe("none")
    const markerScales: string[] = []
    for (let n = 1; n <= 5; n++) {
      const m = findInteractableByName(`Spot${n}_MarkerButton`, undefined, true)
      expect(!!m, `Spot${n}_MarkerButton enabled`).toBe(true)
      markerScales.push(m!.getSceneObject().getTransform().getLocalScale().x.toFixed(2))
    }
    log(`C3 after Quiz me: markers=${j(main.markerVisibleSpots)} markerScales=${j(markerScales)} pulsing=${j(main.pulsingSpots)}`)

    // Step under test 2: pinch marker 1.
    await pinch("Spot1_MarkerButton", main)
    await waitFor(() => main.revealedSpot === 0 && main.answerButtonsVisible, 3000, "spot 1 revealed with ✓/✗", main)
    await sleep(700)

    const gotIt = findInteractableByName("GotItButton", undefined, true)
    const missed = findInteractableByName("MissedButton", undefined, true)
    const targets = findSceneObjectByName("LociAnswerTargets")
    const anchor = findSceneObjectByName("Spot1_AnswerAnchor")
    const host = findSceneObjectByName("AnswerTargets")
    const anchorErr = targets && anchor ? targets.getTransform().getWorldPosition().distance(anchor.getTransform().getWorldPosition()) : -1
    const hostScale = host ? host.getTransform().getLocalScale().x : -1
    log(`C3 after marker 1: revealedSpot=${main.revealedSpot} revealedObjects=${j(main.revealedObjectSpots)} model=${main.placedModelIds[0]} nameTag="${main.nameTagText}" answers=${main.answerButtonsVisible} gotIt=${isEnabled(gotIt)} missed=${isEnabled(missed)} answerHostScale=${hostScale.toFixed(2)} anchorErr=${anchorErr.toFixed(2)}cm markers=${j(main.markerVisibleSpots)}`)

    expect(main.revealedSpot, "spot 1 revealed").toBe(0)
    expect(j(main.revealedObjectSpots), "only spot 1's object is back").toBe(j([0]))
    expect(main.placedModelIds[0], "spot 1 reveals the umbrella").toBe("umbrella")
    expect(main.nameTagText, "name tag").toBe("Umbrella")
    expect(main.answerButtonsVisible, "✓/✗ shown").toBe(true)
    expect(isEnabled(gotIt), "GotItButton (✓) enabled").toBe(true)
    expect(isEnabled(missed), "MissedButton (✗) enabled").toBe(true)
    expect(hostScale > 0.9, `✓/✗ popped in (scale ${hostScale.toFixed(2)})`).toBe(true)
    expect(anchorErr >= 0 && anchorErr < 1, `✓/✗ placed at Spot1_AnswerAnchor (err ${anchorErr.toFixed(2)} cm)`).toBe(true)
    expect(j(main.markerVisibleSpots), "marker 1 gone, 2–5 remain").toBe(j([1, 2, 3, 4]))
    log(`C3 PASS state=${main.getStateJson()}`)
  }
}
