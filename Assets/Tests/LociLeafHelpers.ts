/**
 * LociLeafHelpers — shared plumbing for the Loci LEAF scenarios (test-only).
 *
 * Every step under test is driven by a real SIK pinch: LeafHandInteractor.get("right")
 * moves LEAF's simulated tracked right hand onto the target, forms a pinch gesture and
 * runs SIK's hover → select → release on the project's RightHandInteractor.
 * State is read from LociMain's read-only test getters; nothing here calls LociMain's
 * action methods (press*, pinchItem, pinchMarker, resetToStart).
 */

import {findInteractableByName} from "Leaf.lspkg/Interactors/InteractableUtils"
import {LeafHandInteractor} from "Leaf.lspkg/Interactors/interactor/LeafTwoHandInteractor"
import {findSceneObjectByName, sleep, withTimeout} from "Leaf.lspkg/Utils/common/Utils"
import {LociMain} from "../Scripts/LociMain"
import {Guess} from "../Scripts/LociState"

export const SPOT_PARENTS = ["Spot1_Chair", "Spot2_TableLeft", "Spot3_TableCentre", "Spot4_TableRight", "Spot5_Shelf"]
export const SAMPLE_MODELS = ["umbrella", "key", "milk", "phone", "gift"]

export function log(msg: string): void {
  print("[LociLeaf] " + msg)
}

export function j(v: any): string {
  return JSON.stringify(v)
}

export function getMain(): LociMain {
  const so = findSceneObjectByName("Loci")
  if (!so) throw new Error('SceneObject "Loci" not found')
  const main = so.getComponent(LociMain.getTypeName()) as LociMain
  if (!main) throw new Error('LociMain component not found on "Loci"')
  return main
}

/** Polls `cond` every frame-ish (50 ms) until true; throws with `what` + state on timeout. */
export async function waitFor(cond: () => boolean, timeoutMs: number, what: string, main?: LociMain): Promise<number> {
  const start = getTime()
  while (!cond()) {
    if ((getTime() - start) * 1000 > timeoutMs) {
      throw new Error(`Timed out after ${timeoutMs} ms waiting for: ${what}` + (main ? ` | state=${main.getStateJson()}` : ""))
    }
    await sleep(50)
  }
  return getTime() - start
}

/**
 * Waits for the Lens to be on its start card, then disables gaze dwell for this run only
 * (runtime field write; the scene's saved default of 2 s is untouched and comes back on reset).
 */
export async function setupAtStart(): Promise<LociMain> {
  await sleep(1500)
  const main = getMain()
  await waitFor(() => main.phase === "start" && main.cardView === "start", 8000, "start card", main)
  await waitFor(() => !!findInteractableByName("SampleListButton", undefined, true), 5000, "SampleListButton enabled", main)
  main.gazeDwellSec = 0
  log(`setup: gazeDwellSec=0 for this run; runSelfTest=${main.runSelfTest}; state=${main.getStateJson()}`)
  await sleep(300)
  return main
}

/** One real SIK pinch (right hand) on the interactable whose SceneObject is named `name`. */
export async function pinch(name: string, main?: LociMain, timeoutMs: number = 10000): Promise<void> {
  await waitFor(() => !!findInteractableByName(name, undefined, true), 4000, `interactable "${name}" present and enabled`, main)
  const target = findInteractableByName(name, undefined, true)!
  log(`pinch → ${name}`)
  await withTimeout(
    LeafHandInteractor.get("right").trigger(target),
    timeoutMs,
    `SIK pinch on "${name}" did not complete within ${timeoutMs} ms`,
  )
}

/** Samples LociMain every frame: max simultaneous pulses, which spots pulsed, phase timeline. */
export class LociMonitor {
  maxPulsing = 0
  pulsed: number[] = []
  multiPulse: string[] = []
  phases: {phase: string; t: number}[] = []
  placementCountAt: {n: number; t: number}[] = []
  /** Frame times when the name tag went from hidden to showing (= a study pinch registered). */
  nameShownAt: number[] = []
  /** Frame times when currentSpotIndex changed, with the new value. */
  currentChanges: {i: number; t: number}[] = []
  private lastName = ""

  constructor(owner: BaseScriptComponent, private main: LociMain) {
    owner.createEvent("UpdateEvent").bind(() => this.sample())
    this.sample()
  }

  resetPulseTracking(): void {
    this.maxPulsing = 0
    this.pulsed = []
    this.multiPulse = []
  }

  phaseTime(phase: string): number | undefined {
    const e = this.phases.find((p) => p.phase === phase)
    return e ? e.t : undefined
  }

  private sample(): void {
    const m = this.main
    const t = getTime()
    const ph = m.phase
    if (this.phases.length === 0 || this.phases[this.phases.length - 1].phase !== ph) this.phases.push({phase: ph, t})
    const ps = m.pulsingSpots
    if (ps.length > this.maxPulsing) this.maxPulsing = ps.length
    if (ps.length > 1 && this.multiPulse.length < 5) this.multiPulse.push(`${ph}@${t.toFixed(2)}:${j(ps)}`)
    for (const i of ps) if (this.pulsed.indexOf(i) < 0) this.pulsed.push(i)
    const n = m.placementOrder.length
    const last = this.placementCountAt[this.placementCountAt.length - 1]
    if (!last || last.n !== n) this.placementCountAt.push({n, t})
    const name = m.nameTagText
    if (name !== "" && this.lastName === "") this.nameShownAt.push(t)
    this.lastName = name
    const cur = m.currentSpotIndex
    const lc = this.currentChanges[this.currentChanges.length - 1]
    if (!lc || lc.i !== cur) this.currentChanges.push({i: cur, t})
  }
}

/** Horizontal (XZ) distance between two world points, cm. */
export function flatDist(a: vec3, b: vec3): number {
  const dx = a.x - b.x
  const dz = a.z - b.z
  return Math.sqrt(dx * dx + dz * dz)
}

/** Pinch-driven: Sample list → wait for study at spot 1. */
export async function pinchSampleListAndWaitForStudy(main: LociMain): Promise<void> {
  await pinch("SampleListButton", main)
  await waitFor(() => main.phase === "study" && main.currentSpotIndex === 0, 6000, "study at spot 1 after Sample list", main)
}

/**
 * Pinch-driven study walk over spots fromIdx..4: pinch Spot{n}_Item, wait for the pulse to move.
 * Ends when the group glow → switch card ("Quiz me") shows.
 */
export async function pinchStudyWalkToSwitch(main: LociMain): Promise<void> {
  for (let k = 0; k < 5; k++) {
    await waitFor(() => main.phase === "study" && main.currentSpotIndex === k, 5000, `study at spot ${k + 1}`, main)
    await sleep(250)
    await pinch(`Spot${k + 1}_Item`, main)
    if (k < 4) await waitFor(() => main.currentSpotIndex === k + 1, 5000, `pulse moves to spot ${k + 2}`, main)
  }
  await waitFor(() => main.phase === "switch" && main.cardView === "switch", 6000, "switch card after spot 5", main)
  await waitFor(() => !!findInteractableByName("QuizMeButton", undefined, true), 3000, "QuizMeButton enabled", main)
  await sleep(400)
}

/** Find-it prompt text for each sample-list spot (route order). */
export const SAMPLE_QUESTIONS = ["Where's the umbrella?", "Where are the keys?", "Where's the milk?", "Where's the phone?", "Where's the gift?"]

/** Pinch-driven: Quiz me → objects vanish into 5 markers and Find-it prompt 1 waits for a pinch. */
export async function pinchQuizMeAndWaitForPrompt(main: LociMain): Promise<void> {
  await pinch("QuizMeButton", main)
  await waitFor(
    () => main.phase === "quiz" && main.awaitingGuess && main.quizStep === 0 && j(main.markerVisibleSpots) === j([0, 1, 2, 3, 4]),
    6000,
    "Find-it prompt 1 with 5 markers",
    main,
  )
  await sleep(400)
}

/** Waits until Find-it prompt `step` (0-based) is up and waiting; returns its answer spot. */
export async function waitForPrompt(main: LociMain, step: number): Promise<number> {
  await waitFor(() => main.phase === "quiz" && main.awaitingGuess && main.quizStep === step, 6000, `Find-it prompt ${step + 1} waiting`, main)
  await sleep(350)
  return main.quizTargetSpot
}

/** One real SIK pinch on spot `i`'s marker as the guess; waits until the guess registers. */
export async function pinchGuess(main: LociMain, i: number): Promise<Guess> {
  const before = main.guesses.length
  await pinch(`Spot${i + 1}_MarkerButton`, main)
  await waitFor(() => main.guesses.length === before + 1, 3000, `guess on spot ${i + 1} registered`, main)
  return main.lastGuess!
}

/** A still-hidden spot that is not `target` (for a deliberately wrong guess). */
export function wrongSpotFor(main: LociMain, target: number): number {
  const hidden = main.markerVisibleSpots
  for (const i of hidden) if (i !== target) return i
  throw new Error(`no hidden spot other than ${target + 1} | state=${main.getStateJson()}`)
}

export interface PromptRecord {
  step: number
  target: number
  question: string
  icon: string
  progress: string
  pinched: number
  correct: boolean
}

/**
 * Plays a whole Find-it round by pinching markers: the right spot first time for every
 * prompt except those whose answer spot is in `missSpots` (those get a wrong hidden spot).
 * Returns what each prompt showed. Ends when the results card is up.
 */
export async function playFindIt(main: LociMain, missSpots: number[]): Promise<PromptRecord[]> {
  const out: PromptRecord[] = []
  for (let step = 0; step < 5; step++) {
    const target = await waitForPrompt(main, step)
    const rec: PromptRecord = {
      step,
      target,
      question: main.promptText,
      icon: main.promptIconModelId,
      progress: main.promptProgress,
      pinched: -1,
      correct: false,
    }
    const pick = missSpots.indexOf(target) >= 0 ? wrongSpotFor(main, target) : target
    const g = await pinchGuess(main, pick)
    rec.pinched = g.pinched
    rec.correct = g.correct
    out.push(rec)
    log(`find-it ${step + 1}/5: "${rec.question}" icon=${rec.icon} answer=spot${target + 1} pinched=spot${pick + 1} → ${g.correct ? "correct" : "wrong"}`)
  }
  await waitFor(() => main.phase === "results" && main.cardView === "results", 6000, "results card after 5 prompts", main)
  await sleep(400)
  return out
}
