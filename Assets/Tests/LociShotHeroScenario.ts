/**
 * Screenshot helper (shot-hero), not a test: pinches its way through the real SIK path to a
 * brief moment of the flow and stops there so the preview can be captured for
 * devpost/screenshots/. Study pack on the route; the speech bubble chatters with its name "Ask a question".
 */

import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {j, log, pinch, setupAtStart, waitFor} from "./LociLeafHelpers"

@component
export class LociShotHeroScenario extends Scenario {
  async run(): Promise<void> {
    const main = await setupAtStart()
    main.nameShowSec = 6 // runtime only: hold the name long enough to capture (scene keeps 2 s)
    await pinch("StudyPackButton", main)
    await waitFor(() => main.phase === "study" && main.currentSpotIndex === 0, 8000, "study at spot 1", main)
    await sleep(600)
    await pinch("Spot1_Item", main)
    await waitFor(() => main.nameTagText === "Ask a question", 1500, "name tag", main)
    await sleep(250)
    log(`shot-hero parked: name="${main.nameTagText}" models=${j(main.placedModelIds)}`)
  }
}
