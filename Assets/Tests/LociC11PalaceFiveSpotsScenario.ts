/**
 * Build my palace: 5 pinches create 5 spots, in order.
 * "Build my palace" opens the build card ("Pinch 5 places for your palace", "0 of 5").
 * Each pinch on a surface (chair seat, table, shelf top, floor) drops numbered place n
 * where the ray hit, joined to the previous place by a line, and the progress counts up.
 * After the 5th, the route's 5 spots move to those places and the start card reads
 * "Your palace" with a "Quick route" button.
 * Steps under test (pinch): BuildPalaceButton, then 5 surface points (each via a small
 * aim target; the Lens raycasts the hand's ray against the stand-ins' Box colliders).
 */

import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {PALACE_PLACES, QUICK_ROUTE, fmt, j, log, pinchBuildPalace, pinchPlace, setupAtStart, waitFor} from "./LociLeafHelpers"

const TOLERANCE_CM = 4

@component
export class LociC11PalaceFiveSpotsScenario extends Scenario {
  async run(): Promise<void> {
    const main = await setupAtStart()
    log(`C11 start: route=${main.palaceMode} button="${main.routeButtonLabel}" title="${main.startTitle}" spots=${j(main.spotLocalPositions.map(fmt))}`)
    expect(main.palaceMode, "Quick route is the default").toBe("quick")
    expect(main.routeButtonLabel, "start card offers Build my palace").toBe("Build my palace")
    main.spotLocalPositions.forEach((p, i) => expect(p.distance(QUICK_ROUTE[i]) < 0.5, `spot ${i + 1} on its Quick-route place ${fmt(p)}`).toBe(true))

    await pinchBuildPalace(main)
    log(`C11 build card: hint="${main.buildHint}" progress="${main.buildProgress}"`)
    expect(main.buildHint, "build prompt").toBe("Pinch 5 places for your palace")
    expect(main.buildProgress, "progress before any pinch").toBe("0 of 5")
    expect(main.palaceSpotCount, "no places yet").toBe(0)

    for (let k = 0; k < 5; k++) {
      const place = PALACE_PLACES[k]
      const r = await pinchPlace(main, `PalaceAim${k + 1}`, place.at)
      const got = main.palaceLocalPositions[k]
      log(`C11 pinch ${k + 1} on ${place.what} ${fmt(place.at)} → ${r} at ${got ? fmt(got) : "-"} (${got ? got.distance(place.at).toFixed(2) : "-"} cm off) labels=${j(main.palaceLabels)} lines=${main.palaceLineCount} progress="${main.buildProgress}"`)
      expect(r, `pinch ${k + 1} (${place.what}) accepted`).toBe("added")
      expect(main.palaceSpotCount, `${k + 1} places after pinch ${k + 1}`).toBe(k + 1)
      expect(got.distance(place.at) < TOLERANCE_CM, `place ${k + 1} where the ray hit the ${place.what} (${got.distance(place.at).toFixed(2)} cm off)`).toBe(true)
      expect(j(main.palaceLabels), "numbered in pinch order").toBe(j(["1", "2", "3", "4", "5"].slice(0, k + 1)))
      expect(main.palaceLineCount, `${k} lines join the places in order`).toBe(k)
      if (k < 4) expect(main.buildProgress, "progress counts up").toBe(`${k + 1} of 5`)
      await sleep(200)
    }

    await waitFor(() => main.phase === "start" && main.cardView === "start" && main.palaceMode === "custom", 4000, "start card with the built palace", main)
    await sleep(300)
    const spots = main.spotLocalPositions
    const places = main.palaceLocalPositions
    log(`C11 built: title="${main.startTitle}" button="${main.routeButtonLabel}" places=${j(places.map(fmt))} spots=${j(spots.map(fmt))} visible=${main.palaceVisible}`)
    expect(main.startTitle, "start card title").toBe("Your palace")
    expect(main.routeButtonLabel, "last button switches back to the fixed route").toBe("Quick route")
    expect(main.palaceVisible, "numbered places stay visible on the start card").toBe(true)
    spots.forEach((p, i) => expect(p.distance(places[i]) < 0.5, `route spot ${i + 1} moved to place ${i + 1}`).toBe(true))
    log(`C11 PASS state=${main.getStateJson()}`)
  }
}
