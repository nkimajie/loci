/**
 * Done criterion 1 — "Errands (warm-up)" places the 5 models one at a time, in route order,
 * at chair, table left, table centre, table right, shelf.
 * Step under test: real SIK pinch on ErrandsButton. No setup shortcuts.
 */

import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {findSceneObjectByName, sleep} from "Leaf.lspkg/Utils/common/Utils"
import {LociMonitor, ERRANDS_MODELS, SPOT_PARENTS, j, log, pinch, setupAtStart, waitFor} from "./LociLeafHelpers"

@component
export class LociC1SampleListScenario extends Scenario {
  async run(): Promise<void> {
    const main = await setupAtStart()
    const mon = new LociMonitor(this, main)
    expect(main.placementOrder.length, "nothing placed before the pinch").toBe(0)

    await pinch("ErrandsButton", main)
    await waitFor(() => mon.phaseTime("building") !== undefined, 2000, "building phase after Errands pinch", main)
    const tBuild = mon.phaseTime("building")!

    // Mid-build: objects must still be arriving (one at a time, not all at once).
    await waitFor(() => getTime() - tBuild >= 1.3, 3000, "1.3 s into the build")
    const midCount = main.placementOrder.length
    log(`C1 placed after 1.3 s: ${midCount}`)
    expect(midCount >= 1 && midCount <= 4, `objects arrive one at a time; ${midCount} placed 1.3 s in`).toBe(true)

    await waitFor(() => mon.phaseTime("study") !== undefined, 6000, "study phase after build", main)
    const tStudy = mon.phaseTime("study")!
    await sleep(300)

    const order = main.placementOrder
    const times = main.placementTimes.map((t) => +(t - tBuild).toFixed(3))
    const ids = main.placedModelIds
    log(`C1 placementOrder=${j(order)} placementTimes(rel. to pinch)=${j(times)} placedModelIds=${j(ids)} studyStartsAfter=${(tStudy - tBuild).toFixed(2)}s countTimeline=${j(mon.placementCountAt.map((p) => p.n))}`)

    expect(j(order), "placement order").toBe(j([0, 1, 2, 3, 4]))
    expect(times.length, "5 placement times").toBe(5)
    expect(times[0] > 0.25 && times[0] < 0.7, `first drop ~0.4 s after the pinch, got ${times[0]}`).toBe(true)
    for (let i = 1; i < times.length; i++) {
      const gap = times[i] - times[i - 1]
      expect(gap > 0.4 && gap < 0.75, `placement gap ${i}→${i + 1} should be ~0.55 s, got ${gap.toFixed(3)}`).toBe(true)
    }
    // Count of placed objects only ever stepped up by one.
    const counts = mon.placementCountAt.map((p) => p.n)
    for (let i = 1; i < counts.length; i++) {
      expect(counts[i] - counts[i - 1], `placed count jumped ${counts[i - 1]}→${counts[i]}`).toBe(1)
    }
    expect(j(ids), "placed models in route order").toBe(j(ERRANDS_MODELS))

    for (let i = 0; i < 5; i++) {
      const item = main.spot(i).itemSceneObject
      expect(item.name, `spot ${i + 1} item object`).toBe(`Spot${i + 1}_Item`)
      expect(item.getParent().name, `spot ${i + 1} object parent`).toBe(SPOT_PARENTS[i])
      const visual = findSceneObjectByName(`Spot${i + 1}_Visual`)
      expect(!!visual && visual.getParent().name === `Spot${i + 1}_Item`, `Spot${i + 1}_Visual under Spot${i + 1}_Item`).toBe(true)
      expect(visual!.getChildrenCount() > 0, `Spot${i + 1}_Visual has a built model`).toBe(true)
      const s = visual!.getTransform().getLocalScale().x
      expect(s > 0.5, `Spot${i + 1} model visible (scale ${s.toFixed(2)})`).toBe(true)
    }

    const studyDelay = tStudy - tBuild
    expect(studyDelay > 3.4 && studyDelay < 4.3, `study should start ~3.8 s after the pinch, got ${studyDelay.toFixed(2)}`).toBe(true)
    expect(main.currentSpotIndex, "study starts at spot 1").toBe(0)
    expect(j(main.pulsingSpots), "only spot 1 pulses at study start").toBe(j([0]))
    expect(main.lastListSource, "list source").toBe("errands")
    log(`C1 PASS state=${main.getStateJson()}`)
  }
}
