/**
 * LeafIndex — registers the Loci LEAF scenarios (one per done criterion in
 * devpost/design-brief.md). Attached to the root "LeafIndex" SceneObject.
 */

import {scenariosIndex} from "Leaf.lspkg/Scenarios/decorator/ScenarioIndexDecorator"
import {ScenarioMetadata} from "Leaf.lspkg/Scenarios/scenario/ScenarioMetadata"
import {LociC1SampleListScenario} from "./LociC1SampleListScenario"
import {LociC2StudyWalkScenario} from "./LociC2StudyWalkScenario"
import {LociC3QuizRevealScenario} from "./LociC3QuizRevealScenario"
import {LociC4ResultsReviewScenario} from "./LociC4ResultsReviewScenario"
import {LociC5MixedListScenario} from "./LociC5MixedListScenario"

@component
export class LeafIndex extends BaseScriptComponent {
  @scenariosIndex
  static scenariosIndex: ScenarioMetadata[] = [
    {id: "loci-c1-sample-list", typename: LociC1SampleListScenario.getTypeName()},
    {id: "loci-c2-study-walk", typename: LociC2StudyWalkScenario.getTypeName()},
    {id: "loci-c3-quiz-reveal", typename: LociC3QuizRevealScenario.getTypeName()},
    {id: "loci-c4-results-review", typename: LociC4ResultsReviewScenario.getTypeName()},
    {id: "loci-c5-mixed-list", typename: LociC5MixedListScenario.getTypeName()},
  ]
}
