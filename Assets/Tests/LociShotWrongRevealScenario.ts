/**
 * Screenshot helper (shot-wrong-reveal), not a test: pinches its way through the real SIK path to a
 * brief moment of the flow and stops there so the preview can be captured for
 * devpost/screenshots/. Find-it: a wrong pinch; the right spot shows its object with an orange ring.
 */

import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {j, log, pinchErrandsAndWaitForStudy, pinchGuess, pinchQuizMeAndWaitForPrompt, pinchStudyWalkToSwitch, setupAtStart, waitFor, waitForPrompt, wrongSpotFor} from "./LociLeafHelpers"

@component
export class LociShotWrongRevealScenario extends Scenario {
  async run(): Promise<void> {
    const main = await setupAtStart()
    await pinchErrandsAndWaitForStudy(main)
    await pinchStudyWalkToSwitch(main)
    await pinchQuizMeAndWaitForPrompt(main)
    const target = await waitForPrompt(main, 0)
    await pinchGuess(main, wrongSpotFor(main, target))
    await waitFor(() => main.ringKinds[target] === "orange", 2000, "orange-ring reveal", main)
    await sleep(350)
    log(`shot-wrong-reveal parked: prompt asked spot ${target + 1}, rings=${j(main.ringKinds)} name="${main.nameTagText}"`)
  }
}
