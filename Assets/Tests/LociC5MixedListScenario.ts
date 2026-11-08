/**
 * Done criterion 5 — "Mixed list" shows the key model for "keys" (plural matched), the
 * phone model for "mobile", and a word totem reading exactly "volcano" at table centre,
 * never a near-miss model.
 * Step under test: real SIK pinch on MixedListButton. No setup shortcuts.
 * Leaves the Lens in study at spot 1 with the totem placed (for the review screenshot).
 */

import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {findSceneObjectByName, sleep} from "Leaf.lspkg/Utils/common/Utils"
import {SPOT_PARENTS, j, log, pinch, setupAtStart, waitFor} from "./LociLeafHelpers"

function collectText3D(root: SceneObject, out: {so: SceneObject; t: Text3D}[]): void {
  const comps = root.getComponents("Component.Text3D") as Text3D[]
  for (const t of comps) out.push({so: root, t})
  for (let i = 0; i < root.getChildrenCount(); i++) collectText3D(root.getChild(i), out)
}

@component
export class LociC5MixedListScenario extends Scenario {
  async run(): Promise<void> {
    const main = await setupAtStart()
    await pinch("MixedListButton", main)
    await waitFor(() => main.phase === "building", 2000, "building after Mixed list pinch", main)
    await waitFor(() => main.phase === "study", 6000, "all 5 placed (study begins)", main)
    await sleep(400)

    const words = main.listWords
    const ids = main.placedModelIds
    const totems = main.totemTexts
    log(`C5 listWords=${j(words)} placedModelIds=${j(ids)} totemTexts=${j(totems)} source=${main.lastListSource}`)
    expect(main.lastListSource, "list source").toBe("mixed")
    expect(j(words), "parsed words").toBe(j(["umbrella", "keys", "volcano", "mobile", "gift"]))
    expect(ids[1], '"keys" → key model (plural matched)').toBe("key")
    expect(ids[3], '"mobile" → phone model (synonym)').toBe("phone")
    expect(ids[2], '"volcano" → word totem, not a near-miss model').toBe("totem")
    expect(j(ids), "placed models").toBe(j(["umbrella", "key", "totem", "phone", "gift"]))
    expect(totems[2], "totem text").toBe("volcano")
    expect(j(totems), "only spot 3 is a totem").toBe(j(["", "", "volcano", "", ""]))

    // The rendered Text3D under table centre must read exactly "volcano" — and only once.
    const spot3 = findSceneObjectByName(SPOT_PARENTS[2])
    expect(!!spot3, "Spot3_TableCentre exists").toBe(true)
    const found: {so: SceneObject; t: Text3D}[] = []
    collectText3D(spot3!, found)
    const live = found.filter((f) => f.t.enabled && f.so.isEnabledInHierarchy)
    log(`C5 Text3D under Spot3_TableCentre: total=${found.length} enabled=${live.length} -> ${j(found.map((f) => `${f.so.name}:"${f.t.text}":${f.t.enabled && f.so.isEnabledInHierarchy ? "on" : "off"}`))}`)
    expect(live.length, "exactly one visible Text3D at table centre").toBe(1)
    expect(live[0].t.text, "Text3D text at table centre").toBe("volcano")
    expect(live[0].so.getParent().name, "Text3D lives on the volcano totem").toBe("Totem_volcano")

    // No stray word text at the other spots.
    for (const i of [0, 1, 3, 4]) {
      const other: {so: SceneObject; t: Text3D}[] = []
      collectText3D(findSceneObjectByName(SPOT_PARENTS[i])!, other)
      const otherLive = other.filter((f) => f.t.enabled && f.so.isEnabledInHierarchy)
      expect(otherLive.length, `no visible Text3D at ${SPOT_PARENTS[i]}`).toBe(0)
    }
    log(`C5 PASS state=${main.getStateJson()}`)
  }
}
