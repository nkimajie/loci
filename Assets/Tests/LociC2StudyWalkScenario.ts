/**
 * Done criterion 2 — pinching the current object moves the pulse and arrow to the next
 * spot, only one spot pulses at a time, and "Quiz me" appears after spot 5.
 * Setup (pinch): ErrandsButton. Steps under test (pinch): Spot1_Item … Spot5_Item,
 * plus one pinch on a non-current object (Spot2_Item while spot 1 is current) that must be ignored.
 */

import {findInteractableByName} from "Leaf.lspkg/Interactors/InteractableUtils"
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {findSceneObjectByName, sleep} from "Leaf.lspkg/Utils/common/Utils"
import {LociMain} from "../Scripts/LociMain"
import {LociMonitor, flatDist, j, log, pinch, pinchErrandsAndWaitForStudy, setupAtStart, waitFor} from "./LociLeafHelpers"

function checkArrowAt(main: LociMain, k: number): string {
  const arrow = findSceneObjectByName("RouteArrow")
  expect(!!arrow, "RouteArrow exists").toBe(true)
  expect(main.guide.isVisible && arrow!.isEnabledInHierarchy, `route arrow visible over spot ${k + 1}`).toBe(true)
  const spot = main.spot(k)
  const targetErr = main.guide.targetWorldPos.distance(spot.arrowWorldPos)
  const a = arrow!.getTransform().getWorldPosition()
  const flat = flatDist(a, spot.surfaceWorldPos)
  const above = a.y - spot.surfaceWorldPos.y
  expect(targetErr < 1, `arrow target should be spot ${k + 1}'s arrow point (err ${targetErr.toFixed(2)} cm)`).toBe(true)
  expect(flat < 3, `arrow should hang over spot ${k + 1} (horizontal offset ${flat.toFixed(2)} cm)`).toBe(true)
  expect(above > 5, `arrow should be above spot ${k + 1} (${above.toFixed(1)} cm)`).toBe(true)
  return `spot${k + 1}: flat=${flat.toFixed(2)}cm above=${above.toFixed(1)}cm`
}

@component
export class LociC2StudyWalkScenario extends Scenario {
  async run(): Promise<void> {
    const main = await setupAtStart()
    const mon = new LociMonitor(this, main)
    await pinchErrandsAndWaitForStudy(main)
    mon.resetPulseTracking()
    const arrowLog: string[] = []
    const advanceSec: string[] = []

    expect(j(main.pulsingSpots), "only spot 1 pulses at study start").toBe(j([0]))

    // A pinch on a non-current object must not advance the walk.
    try {
      await pinch("Spot2_Item", main, 4000)
      log("C2 non-current pinch on Spot2_Item completed (SIK events fired)")
    } catch (e) {
      log(`C2 non-current pinch on Spot2_Item did not complete (${e}) — treated as ignored`)
    }
    await sleep(600)
    expect(main.currentSpotIndex, "pinching Spot2_Item while spot 1 is current is ignored").toBe(0)
    expect(j(main.visitedSpots), "no spot visited by the non-current pinch").toBe(j([]))
    expect(main.nameTagText, "no name shown for the ignored pinch").toBe("")

    for (let k = 0; k < 5; k++) {
      await waitFor(() => main.phase === "study" && main.currentSpotIndex === k, 5000, `study at spot ${k + 1}`, main)
      await sleep(250)
      expect(j(main.pulsingSpots), `only spot ${k + 1} pulses`).toBe(j([k]))
      arrowLog.push(checkArrowAt(main, k))

      const namesBefore = mon.nameShownAt.length
      await pinch(`Spot${k + 1}_Item`, main)
      // The pinch registers on SIK trigger-end (name tag appears that frame), slightly before
      // LEAF's trigger() resolves, so time the advance from the name-tag frame.
      await waitFor(() => mon.nameShownAt.length > namesBefore, 1500, `name tag after pinching spot ${k + 1}`, main)
      const t0 = mon.nameShownAt[mon.nameShownAt.length - 1]
      if (k < 4) {
        await waitFor(() => mon.currentChanges.some((c) => c.i === k + 1), 5000, `pulse moves to spot ${k + 2}`, main)
        const moved = mon.currentChanges.filter((c) => c.i === k + 1).pop()!
        const dt = moved.t - t0
        advanceSec.push(dt.toFixed(2))
        expect(dt > 1.8 && dt < 2.6, `pulse should move ~2 s (nameShowSec) after the pinch registers, took ${dt.toFixed(2)}`).toBe(true)
        expect(j(main.pulsingSpots), `pulse moved to spot ${k + 2} only`).toBe(j([k + 1]))
      } else {
        await waitFor(() => mon.phaseTime("groupGlow") !== undefined, 5000, "group glow after spot 5", main)
        advanceSec.push((mon.phaseTime("groupGlow")! - t0).toFixed(2))
        expect(j(main.glowingSpots), "all 5 glow together").toBe(j([0, 1, 2, 3, 4]))
        expect(j(main.pulsingSpots), "nothing pulses during group glow").toBe(j([]))
        expect(main.cardView, "no card during group glow").toBe("none")
      }
    }

    await waitFor(() => main.phase === "switch" && main.cardView === "switch" && mon.phaseTime("switch") !== undefined, 4000, "switch card after group glow", main)
    const glowSec = mon.phaseTime("switch")! - mon.phaseTime("groupGlow")!
    expect(glowSec > 1.7 && glowSec < 2.6, `group glow should last ~2 s, got ${glowSec.toFixed(2)}`).toBe(true)
    await waitFor(() => !!findInteractableByName("QuizMeButton", undefined, true), 3000, "QuizMeButton enabled", main)
    await sleep(500)
    const quiz = findInteractableByName("QuizMeButton", undefined, true)!
    const card = findSceneObjectByName("SwitchCard")
    const cardScale = card ? card.getTransform().getLocalScale().x : -1
    expect(quiz.getSceneObject().isEnabledInHierarchy, "QuizMeButton enabled in hierarchy").toBe(true)
    expect(cardScale > 0.9, `switch card popped in (scale ${cardScale.toFixed(2)})`).toBe(true)

    log(`C2 visited=${j(main.visitedSpots)} advanceSec=${j(advanceSec)} arrows=${j(arrowLog)} maxPulsing=${mon.maxPulsing} pulsedOrder=${j(mon.pulsed)} multiPulse=${j(mon.multiPulse)} groupGlowSec=${glowSec.toFixed(2)} glowing@switch=${j(main.glowingSpots)} switchCardScale=${cardScale.toFixed(2)}`)
    expect(mon.maxPulsing <= 1, `never more than one spot pulsing (max ${mon.maxPulsing}; ${j(mon.multiPulse)})`).toBe(true)
    expect(j(mon.pulsed), "spots pulsed in route order").toBe(j([0, 1, 2, 3, 4]))
    expect(j(main.visitedSpots), "all 5 visited in order").toBe(j([0, 1, 2, 3, 4]))
    log(`C2 PASS state=${main.getStateJson()}`)
  }
}
