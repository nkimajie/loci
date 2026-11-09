/**
 * LeafIndex — registers the Loci LEAF scenarios: C1–C5 are the done criteria in
 * devpost/design-brief.md (C1 now on "Errands (warm-up)", C3/C4 updated for the v2 Find-it
 * quiz); C6–C9 cover the Find-it details (wrong pinch reveals the right spot, each item asked
 * once, Quiz again resets the score, New list clears every spot); C10 covers the scientific-
 * method Study pack and the start card; C11–C13 cover Build my palace (5 pinches make 5
 * places in order, a too-close pinch is rejected, the quiz works on custom spots).
 * shot-* entries are screenshot helpers, not tests (LociShot*Scenario.ts).
 * Attached to the root "LeafIndex" SceneObject.
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
import {LociC10StudyPackScenario} from "./LociC10StudyPackScenario"
import {LociC11PalaceFiveSpotsScenario} from "./LociC11PalaceFiveSpotsScenario"
import {LociC12PalaceTooCloseScenario} from "./LociC12PalaceTooCloseScenario"
import {LociC13PalaceQuizScenario} from "./LociC13PalaceQuizScenario"
import {LociShotHeroScenario} from "./LociShotHeroScenario"
import {LociShotResultsScenario} from "./LociShotResultsScenario"
import {LociShotStudyNameScenario} from "./LociShotStudyNameScenario"
import {LociShotWrongRevealScenario} from "./LociShotWrongRevealScenario"

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
    {id: "loci-c10-study-pack", typename: LociC10StudyPackScenario.getTypeName()},
    {id: "loci-c11-palace-five-spots", typename: LociC11PalaceFiveSpotsScenario.getTypeName()},
    {id: "loci-c12-palace-too-close", typename: LociC12PalaceTooCloseScenario.getTypeName()},
    {id: "loci-c13-palace-quiz", typename: LociC13PalaceQuizScenario.getTypeName()},
    // Screenshot helpers (not tests).
    {id: "shot-hero", typename: LociShotHeroScenario.getTypeName()},
    {id: "shot-study-name", typename: LociShotStudyNameScenario.getTypeName()},
    {id: "shot-wrong-reveal", typename: LociShotWrongRevealScenario.getTypeName()},
    {id: "shot-results", typename: LociShotResultsScenario.getTypeName()},
  ]
}
