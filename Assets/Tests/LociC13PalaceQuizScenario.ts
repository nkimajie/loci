/**
 * Build my palace: the whole flow works on custom spots.
 * Build 5 places, then "Errands (warm-up)": the 5 objects drop onto the custom places in
 * order (the numbered places hide), the study walk pulses them in pinch order, Find-it
 * hides them behind markers at the custom places, and missing the milk gives "4 / 5" with
 * only the milk's custom place glowing. "New list" keeps the palace ("Your palace", places
 * showing); "Quick route" then puts the spots back on the fixed route.
 * Steps under test (pinch): BuildPalaceButton, 5 surface points, ErrandsButton,
 * Spot1_Item … Spot5_Item, QuizMeButton, Spot{n}_MarkerButton ×5, NewListButton,
 * BuildPalaceButton (now "Quick route").
 */

import {findInteractableByName} from "Leaf.lspkg/Interactors/InteractableUtils"
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {findSceneObjectByName, sleep} from "Leaf.lspkg/Utils/common/Utils"
import {
  ERRANDS_MODELS,
  PALACE_PLACES,
  QUICK_ROUTE,
  buildPalace,
  fmt,
  j,
  log,
  pinch,
  pinchErrandsAndWaitForStudy,
  pinchQuizMeAndWaitForPrompt,
  pinchStudyWalkToSwitch,
  playFindIt,
  setupAtStart,
  waitFor,
} from "./LociLeafHelpers"

const MILK_SPOT = 2

function toRoom(main: any, world: vec3): vec3 {
  return (main.palaceRoot as SceneObject).getTransform().getInvertedWorldTransform().multiplyPoint(world)
}

/** Horizontal (room XZ) distance. */
function flat(a: vec3, b: vec3): number {
  const dx = a.x - b.x
  const dz = a.z - b.z
  return Math.sqrt(dx * dx + dz * dz)
}

@component
export class LociC13PalaceQuizScenario extends Scenario {
  async run(): Promise<void> {
    const main = await setupAtStart()
    await buildPalace(main, PALACE_PLACES.map((p) => p.at))
    const places = main.palaceLocalPositions
    log(`C13 palace: ${j(places.map(fmt))}`)

    // Errands drop onto the custom places.
    await pinchErrandsAndWaitForStudy(main)
    await sleep(300)
    const items = [0, 1, 2, 3, 4].map((i) => toRoom(main, main.spot(i).itemCenterWorldPos))
    log(`C13 dropped: models=${j(main.placedModelIds)} order=${j(main.placementOrder)} items=${j(items.map(fmt))} placesVisible=${main.palaceVisible}`)
    expect(j(main.placedModelIds), "errands models").toBe(j(ERRANDS_MODELS))
    expect(j(main.placementOrder), "dropped in pinch order").toBe(j([0, 1, 2, 3, 4]))
    items.forEach((p, i) => expect(flat(p, places[i]) < 1 && p.y > places[i].y, `object ${i + 1} sits on custom place ${i + 1}`).toBe(true))
    expect(main.palaceVisible, "numbered places hide while the objects are out").toBe(false)

    await pinchStudyWalkToSwitch(main)
    await pinchQuizMeAndWaitForPrompt(main)
    const markers = [0, 1, 2, 3, 4].map((i) => toRoom(main, findSceneObjectByName(`Spot${i + 1}_Marker`)!.getTransform().getWorldPosition()))
    log(`C13 find-it markers=${j(main.markerVisibleSpots)} at ${j(markers.map(fmt))} revealed=${j(main.revealedObjectSpots)}`)
    expect(j(main.markerVisibleSpots), "5 markers").toBe(j([0, 1, 2, 3, 4]))
    expect(j(main.revealedObjectSpots), "objects hidden").toBe(j([]))
    markers.forEach((p, i) => expect(flat(p, places[i]) < 1, `marker ${i + 1} above custom place ${i + 1}`).toBe(true))

    const prompts = await playFindIt(main, [MILK_SPOT])
    log(`C13 results: score="${main.scoreText}" missed=${j(main.missedSpots)} glowing=${j(main.glowingSpots)} prompts=${j(prompts.map((p) => `${p.question}→${p.correct}`))}`)
    expect(main.scoreText, "score").toBe("4 / 5")
    expect(j(main.missedSpots), "milk missed").toBe(j([MILK_SPOT]))
    expect(j(main.glowingSpots), "only the milk's custom place glows").toBe(j([MILK_SPOT]))

    // New list keeps the palace; Quick route puts the fixed route back.
    await waitFor(() => !!findInteractableByName("NewListButton", undefined, true), 3000, "NewListButton enabled", main)
    await pinch("NewListButton", main)
    await waitFor(() => main.phase === "start" && main.cardView === "start", 4000, "start card after New list", main)
    await sleep(400)
    log(`C13 after New list: route=${main.palaceMode} title="${main.startTitle}" button="${main.routeButtonLabel}" visible=${main.palaceVisible} models=${j(main.placedModelIds)}`)
    expect(main.palaceMode, "palace kept for the next list").toBe("custom")
    expect(main.startTitle, "title").toBe("Your palace")
    expect(main.palaceVisible, "numbered places showing again").toBe(true)
    expect(j(main.placedModelIds), "objects cleared").toBe(j(["", "", "", "", ""]))

    await pinch("BuildPalaceButton", main)
    await waitFor(() => main.palaceMode === "quick", 2000, "Quick route", main)
    await sleep(300)
    log(`C13 quick route: button="${main.routeButtonLabel}" title="${main.startTitle}" visible=${main.palaceVisible} spots=${j(main.spotLocalPositions.map(fmt))}`)
    expect(main.routeButtonLabel, "button back to Build my palace").toBe("Build my palace")
    expect(main.startTitle, "title back").toBe("Loci")
    expect(main.palaceVisible, "places gone").toBe(false)
    main.spotLocalPositions.forEach((p, i) => expect(p.distance(QUICK_ROUTE[i]) < 0.5, `spot ${i + 1} back on the fixed route`).toBe(true))
    log(`C13 PASS state=${main.getStateJson()}`)
  }
}
