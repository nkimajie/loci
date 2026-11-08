/**
 * LeafIndex — registers the Loci LEAF scenarios: C1–C5 are the done criteria in
 * devpost/design-brief.md (C3/C4 updated for the v2 Find-it quiz); C6–C9 cover the
 * Find-it details (wrong pinch reveals the right spot, each item asked once, Quiz again
 * resets the score, New list clears every spot). Attached to the root "LeafIndex" SceneObject.
 */

import {scenariosIndex} from "Leaf.lspkg/Scenarios/decorator/ScenarioIndexDecorator"
import {ScenarioMetadata} from "Leaf.lspkg/Scenarios/scenario/ScenarioMetadata"
import {LociC1SampleListScenario} from "./LociC1SampleListScenario"
import {LociC2StudyWalkScenario} from "./LociC2StudyWalkScenario"
import {LociC3QuizRevealScenario} from "./LociC3QuizRevealScenario"
import {LociC4ResultsReviewScenario} from "./LociC4ResultsReviewScenario"
import {LociC5MixedListScenario} from "./LociC5MixedListScenario"
import {LociC6WrongRevealsCorrectScenario} from "./LociC6WrongRevealsCorrectScenario"
import {LociC7EachItemOnceScenario} from "./LociC7EachItemOnceScenario"
import {LociC8QuizAgainResetsScenario} from "./LociC8QuizAgainResetsScenario"
import {LociC9NewListClearsScenario} from "./LociC9NewListClearsScenario"

@component
export class LeafIndex extends BaseScriptComponent {
  @scenariosIndex
  static scenariosIndex: ScenarioMetadata[] = [
    {id: "loci-c1-sample-list", typename: LociC1SampleListScenario.getTypeName()},
    {id: "loci-c2-study-walk", typename: LociC2StudyWalkScenario.getTypeName()},
    {id: "loci-c3-quiz-reveal", typename: LociC3QuizRevealScenario.getTypeName()},
    {id: "loci-c4-results-review", typename: LociC4ResultsReviewScenario.getTypeName()},
    {id: "loci-c5-mixed-list", typename: LociC5MixedListScenario.getTypeName()},
    {id: "loci-c6-wrong-reveals-correct", typename: LociC6WrongRevealsCorrectScenario.getTypeName()},
    {id: "loci-c7-each-item-once", typename: LociC7EachItemOnceScenario.getTypeName()},
    {id: "loci-c8-quiz-again-resets", typename: LociC8QuizAgainResetsScenario.getTypeName()},
    {id: "loci-c9-new-list-clears", typename: LociC9NewListClearsScenario.getTypeName()},
  ]
}
