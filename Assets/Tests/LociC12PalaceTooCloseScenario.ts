/**
 * Build my palace: a pinch closer than 25 cm to an existing place is rejected (and the
 * build card's "Quick route" cancels).
 * First, Build → place 1 → "Quick route": every place disappears and the route's spots stay
 * on the fixed route. Then Build again: after places 1 and 2, a pinch ~12 cm from place 2
 * adds nothing — place 2 shakes gently, the card says "Too close to place 2 — try 25 cm
 * away", progress stays "2 of 5". A pinch far enough away is then accepted as place 3.
 * Ends on the build card at "3 of 5" (handy for a screenshot).
 * Steps under test (pinch): BuildPalaceButton, a surface point, BuildCancelButton,
 * BuildPalaceButton, 4 surface points.
 */

import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {PALACE_PLACES, QUICK_ROUTE, fmt, j, log, pinch, pinchBuildPalace, pinchPlace, setupAtStart, waitFor} from "./LociLeafHelpers"

@component
export class LociC12PalaceTooCloseScenario extends Scenario {
  async run(): Promise<void> {
    const main = await setupAtStart()

    // "Quick route" on the build card cancels.
    await pinchBuildPalace(main)
    expect(await pinchPlace(main, "PalaceAimCancel", PALACE_PLACES[0].at), "a first place").toBe("added")
    await sleep(200)
    await pinch("BuildCancelButton", main)
    await waitFor(() => main.phase === "start" && main.cardView === "start", 3000, "start card after Quick route", main)
    await sleep(300)
    log(`C12 cancelled: route=${main.palaceMode} count=${main.palaceSpotCount} visible=${main.palaceVisible} button="${main.routeButtonLabel}" spots=${j(main.spotLocalPositions.map(fmt))}`)
    expect(main.palaceMode, "still on the Quick route").toBe("quick")
    expect(main.palaceSpotCount, "places cleared").toBe(0)
    expect(main.palaceVisible, "nothing left showing").toBe(false)
    expect(main.routeButtonLabel, "Build my palace offered again").toBe("Build my palace")
    main.spotLocalPositions.forEach((p, i) => expect(p.distance(QUICK_ROUTE[i]) < 0.5, `spot ${i + 1} on the fixed route`).toBe(true))

    // Build again: two places, then a too-close pinch.
    await pinchBuildPalace(main)
    expect(main.buildProgress, "a fresh build starts at 0").toBe("0 of 5")
    expect(await pinchPlace(main, "PalaceAim1", PALACE_PLACES[0].at), "place 1").toBe("added")
    await sleep(200)
    expect(await pinchPlace(main, "PalaceAim2", PALACE_PLACES[1].at), "place 2").toBe("added")
    await sleep(200)

    // Step under test: a pinch ~12 cm from place 2.
    const tooClose = PALACE_PLACES[1].at.add(new vec3(10, 0, 6))
    const r = await pinchPlace(main, "PalaceAimTooClose", tooClose)
    const shaking = main.palaceShaking
    log(`C12 too-close pinch at ${fmt(tooClose)} (${tooClose.distance(main.palaceLocalPositions[1]).toFixed(1)} cm from place 2) → ${r}; count=${main.palaceSpotCount} rejects=${main.palaceRejects} shaking=${j(shaking)} status="${main.buildStatus}" progress="${main.buildProgress}"`)
    expect(r, "too-close pinch rejected").toBe("rejected")
    expect(main.palaceSpotCount, "still 2 places").toBe(2)
    expect(main.palaceLineCount, "still 1 line").toBe(1)
    expect(j(shaking), "place 2 shakes").toBe(j([1]))
    expect(main.buildStatus, "card explains").toBe("Too close to place 2 — try 25 cm away")
    expect(main.buildProgress, "progress unchanged").toBe("2 of 5")
    await waitFor(() => main.palaceShaking.length === 0, 1500, "shake settles", main)
    expect(main.palaceLocalPositions[1].distance(PALACE_PLACES[1].at) < 0.5, "place 2 back where it was after the shake").toBe(true)

    // A far-enough pinch is still accepted.
    expect(await pinchPlace(main, "PalaceAim3", PALACE_PLACES[2].at), "place 3 (far enough)").toBe("added")
    await sleep(500)
    log(`C12 after place 3: count=${main.palaceSpotCount} lines=${main.palaceLineCount} status="${main.buildStatus}" progress="${main.buildProgress}" phase=${main.phase} card=${main.cardView}`)
    expect(main.palaceSpotCount, "3 places").toBe(3)
    expect(main.palaceLineCount, "2 lines").toBe(2)
    expect(main.buildStatus, "status cleared").toBe("")
    expect(main.buildProgress, "progress").toBe("3 of 5")
    expect(main.cardView, "still building").toBe("build")
    log(`C12 PASS state=${main.getStateJson()}`)
  }
}
