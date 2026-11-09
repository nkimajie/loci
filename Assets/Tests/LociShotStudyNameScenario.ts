/**
 * Screenshot helper (shot-study-name), not a test: pinches its way through the real SIK path to a
 * brief moment of the flow and stops there so the preview can be captured for
 * devpost/screenshots/. Errands on the route; the umbrella spins open with its name.
 */

import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {log, pinch, pinchErrandsAndWaitForStudy, setupAtStart, waitFor} from "./LociLeafHelpers"

@component
export class LociShotStudyNameScenario extends Scenario {
  async run(): Promise<void> {
    const main = await setupAtStart()
    main.nameShowSec = 6 // runtime only: hold the name long enough to capture (scene keeps 2 s)
    await pinchErrandsAndWaitForStudy(main)
    await sleep(600)
    await pinch("Spot1_Item", main)
    await waitFor(() => main.nameTagText === "Umbrella", 1500, "name tag", main)
    await sleep(250)
    log(`shot-study-name parked: name="${main.nameTagText}"`)
  }
}
