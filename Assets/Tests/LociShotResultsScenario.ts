/**
 * Screenshot helper (shot-results), not a test: pinches its way through the real SIK path to a
 * brief moment of the flow and stops there so the preview can be captured for
 * devpost/screenshots/. Results "4 / 5" with the milk's spot glowing.
 */

import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {j, log, pinchErrandsAndWaitForStudy, pinchQuizMeAndWaitForPrompt, pinchStudyWalkToSwitch, playFindIt, setupAtStart} from "./LociLeafHelpers"

const MILK_SPOT = 2

@component
export class LociShotResultsScenario extends Scenario {
  async run(): Promise<void> {
    const main = await setupAtStart()
    await pinchErrandsAndWaitForStudy(main)
    await pinchStudyWalkToSwitch(main)
    await pinchQuizMeAndWaitForPrompt(main)
    await playFindIt(main, [MILK_SPOT])
    await sleep(300)
    log(`shot-results parked: score="${main.scoreText}" glowing=${j(main.glowingSpots)}`)
  }
}
