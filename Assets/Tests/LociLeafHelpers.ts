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
import {Interactable} from "SpectaclesInteractionKit.lspkg/Components/Interaction/Interactable/Interactable"
import {DefaultLeafInteractor} from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor"
import {LeafHandInteractor} from "Leaf.lspkg/Interactors/interactor/LeafTwoHandInteractor"
import {findSceneObjectByName, sleep, withTimeout} from "Leaf.lspkg/Utils/common/Utils"
import {LociMain} from "../Scripts/LociMain"
import {Guess} from "../Scripts/LociState"

export const SPOT_PARENTS = ["Spot1_Chair", "Spot2_TableLeft", "Spot3_TableCentre", "Spot4_TableRight", "Spot5_Shelf"]
/** "Errands (warm-up)" pack (the v1 "Sample list"): models in route order. */
export const ERRANDS_MODELS = ["umbrella", "key", "milk", "phone", "gift"]
/** "Study pack" (the scientific method): models, name-tag labels and Find-it questions in route order. */
export const STUDY_MODELS = ["speech", "magnifier", "bulb", "flask", "flag"]
export const STUDY_LABELS = ["Ask a question", "Research", "Hypothesis", "Experiment", "Conclusion"]
export const STUDY_QUESTIONS = [
  "Where's the question?",
  "Where's the research?",
  "Where's the hypothesis?",
  "Where's the experiment?",
  "Where's the conclusion?",
]

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
  await waitFor(() => !!findInteractableByName("ErrandsButton", undefined, true), 5000, "ErrandsButton enabled", main)
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

/** Pinch-driven: Errands (warm-up) → wait for study at spot 1. */
export async function pinchErrandsAndWaitForStudy(main: LociMain): Promise<void> {
  await pinch("ErrandsButton", main)
  await waitFor(() => main.phase === "study" && main.currentSpotIndex === 0, 6000, "study at spot 1 after Errands", main)
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

/** Find-it prompt text for each Errands spot (route order). */
export const ERRANDS_QUESTIONS = ["Where's the umbrella?", "Where are the keys?", "Where's the milk?", "Where's the phone?", "Where's the gift?"]

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

// ── Build my palace ─────────────────────────────────────────────────────────

/** Authored Quick-route spots (room space): chair seat, table left, table centre, table right, shelf top. */
export const QUICK_ROUTE = [
  new vec3(-80, 45, -80),
  new vec3(-35, 75, -90),
  new vec3(0, 75, -110),
  new vec3(35, 75, -90),
  new vec3(90, 120, -100),
]

/** Five custom places (room space, on top of surfaces), none of them a Quick-route spot. */
export const PALACE_PLACES = [
  {what: "chair seat", at: new vec3(-75, 45, -72)},
  {what: "table left", at: new vec3(-45, 75, -100)},
  {what: "table right", at: new vec3(45, 75, -100)},
  {what: "shelf top", at: new vec3(90, 120, -96)},
  {what: "floor", at: new vec3(60, 0, -25)},
]

export function roomDist(a: vec3, b: vec3): number {
  return a.distance(b)
}

export function fmt(v: vec3): string {
  return `(${v.x.toFixed(1)}, ${v.y.toFixed(1)}, ${v.z.toFixed(1)})`
}

/**
 * A thin pinch target (a 4 cm pad, 2 mm thick) centred on a room-space surface point, so the
 * far pointer's ray runs from the camera exactly through that point. The Lens raycasts that
 * ray against the stand-ins' colliders and ignores this helper.
 */
export function makeAimPoint(main: LociMain, name: string, roomLocal: vec3): SceneObject {
  const so = global.scene.createSceneObject(name)
  so.setParent(main.palaceRoot)
  so.getTransform().setLocalPosition(roomLocal)
  const c = so.createComponent("Physics.ColliderComponent") as ColliderComponent
  const box = Shape.createBoxShape()
  box.size = new vec3(4, 0.2, 4)
  c.shape = box
  c.fitVisual = false
  so.createComponent(Interactable.getTypeName())
  return so
}

/**
 * Far-field pointer for pinching places: a LEAF-driven SIK interactor whose ray runs from the
 * camera through the target, like a mouse click in the preview or a far pinch on Specs.
 * (LEAF's simulated hand pinches up close, with a short ray beside the target, which can
 * reach a surface from below.) One per Build-my-palace run; LEAF cleans it up afterwards.
 */
let farPointer: DefaultLeafInteractor | null = null

/** Pinch-driven: start card "Build my palace" → the build card waits for places. */
export async function pinchBuildPalace(main: LociMain): Promise<void> {
  farPointer = new DefaultLeafInteractor("LociFarPointer")
  await waitFor(() => main.routeButtonLabel === "Build my palace", 2000, "Build my palace button", main)
  await pinch("BuildPalaceButton", main)
  await waitFor(() => main.phase === "palace" && main.cardView === "build", 3000, "build card after Build my palace", main)
  await sleep(300)
}

/** One real SIK pinch aimed at a room-space point; resolves once the Lens added or rejected it. */
export async function pinchPlace(main: LociMain, name: string, roomLocal: vec3): Promise<"added" | "rejected"> {
  const count = main.palaceSpotCount
  const rejects = main.palaceRejects
  const aim = makeAimPoint(main, name, roomLocal)
  await sleep(100)
  try {
    await waitFor(() => !!findInteractableByName(name, undefined, true), 2000, `aim target "${name}"`, main)
    const target = findInteractableByName(name, undefined, true)!
    if (!farPointer) throw new Error("pinchBuildPalace() must run before pinchPlace()")
    log(`pinch (far) → ${name} at ${fmt(roomLocal)}`)
    await withTimeout(farPointer.trigger(target), 10000, `far pinch on "${name}" did not complete within 10000 ms`)
    await waitFor(() => main.palaceSpotCount !== count || main.palaceRejects !== rejects, 3000, `pinch at ${fmt(roomLocal)} counted`, main)
  } finally {
    aim.destroy()
  }
  return main.palaceRejects !== rejects ? "rejected" : "added"
}

/** Builds a palace on `places` (all accepted) and waits for the "Your palace" start card. */
export async function buildPalace(main: LociMain, places: vec3[]): Promise<void> {
  await pinchBuildPalace(main)
  for (let k = 0; k < places.length; k++) {
    const r = await pinchPlace(main, `PalaceAim${k + 1}`, places[k])
    if (r !== "added") throw new Error(`place ${k + 1} at ${fmt(places[k])} was rejected | state=${main.getStateJson()}`)
    await sleep(200)
  }
  await waitFor(() => main.phase === "start" && main.cardView === "start" && main.palaceMode === "custom", 4000, "start card with the built palace", main)
  await waitFor(() => !!findInteractableByName("ErrandsButton", undefined, true), 3000, "start card buttons live", main)
  await sleep(300)
}
