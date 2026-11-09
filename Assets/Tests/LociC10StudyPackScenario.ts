/**
 * Study pack (the scientific method).
 * The start card offers Study pack / Errands (warm-up) / Mixed list, top to bottom, and the
 * preview leaves out "Say my list" (voice is on-device only). The pack's synonyms match.
 * "Study pack" drops a speech bubble, magnifying glass, light bulb, flask and checkered flag
 * in route order; pinching each one shows its step's name and plays its own silly animation,
 * which then settles back to rest; the Find-it quiz asks for each step by name
 * ("Where's the hypothesis?") with that step's 3D icon and ends at "5 / 5".
 * Steps under test (pinch): StudyPackButton, Spot1_Item … Spot5_Item, QuizMeButton,
 * Spot{answer}_MarkerButton ×5.
 */

import {findInteractableByName} from "Leaf.lspkg/Interactors/InteractableUtils"
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {findSceneObjectByName, sleep} from "Leaf.lspkg/Utils/common/Utils"
import {ElementContent} from "SpectaclesUIKit.lspkg/Scripts/Components/Content/ElementContent"
import {matchModel} from "../Scripts/LociParser"
import {
  STUDY_LABELS,
  STUDY_MODELS,
  STUDY_QUESTIONS,
  j,
  log,
  pinch,
  pinchQuizMeAndWaitForPrompt,
  playFindIt,
  setupAtStart,
  waitFor,
} from "./LociLeafHelpers"

const START_BUTTONS = [
  {name: "StudyPackButton", label: "Study pack"},
  {name: "ErrandsButton", label: "Errands (warm-up)"},
  {name: "MixedListButton", label: "Mixed list"},
]

const SYNONYMS: [string, string | null][] = [
  ["speech bubble", "speech"],
  ["question", "speech"],
  ["questions", "speech"],
  ["ask a question", "speech"],
  ["magnifying glass", "magnifier"],
  ["magnifier", "magnifier"],
  ["research", "magnifier"],
  ["light bulb", "bulb"],
  ["lightbulb", "bulb"],
  ["idea", "bulb"],
  ["hypothesis", "bulb"],
  ["flask", "flask"],
  ["beaker", "flask"],
  ["experiments", "flask"],
  ["checkered flag", "flag"],
  ["chequered flag", "flag"],
  ["finish line", "flag"],
  ["conclusion", "flag"],
  // Near-misses stay word totems.
  ["glass", null],
  ["volcano", null],
]

interface Rest {
  pos: vec3
  rot: quat
  scale: vec3
  enabled: boolean
}

/** Per-frame record of how far a model's root and groups move from rest during its animation. */
class AnimProbe {
  rootMoveCm = 0
  rootTurn = 0
  groupMove: {[g: string]: number} = {}
  groupScale: {[g: string]: number} = {}
  groupShown: string[] = []
  private root: SceneObject | null = null
  private rootRest: Rest | null = null
  private groups: {so: SceneObject; name: string; rest: Rest}[] = []
  private active = false

  constructor(owner: BaseScriptComponent) {
    owner.createEvent("UpdateEvent").bind(() => this.sample())
  }

  /** Captures the rest pose of the model under Spot{n}_Visual and starts sampling. */
  arm(spotIndex: number): string {
    const visual = findSceneObjectByName(`Spot${spotIndex + 1}_Visual`)
    if (!visual || visual.getChildrenCount() === 0) throw new Error(`Spot${spotIndex + 1}_Visual has no model`)
    this.root = visual.getChild(0)
    this.rootRest = AnimProbe.rest(this.root)
    this.groups = []
    for (let i = 0; i < this.root.getChildrenCount(); i++) {
      const c = this.root.getChild(i)
      if (c.name.indexOf("Group_") === 0) this.groups.push({so: c, name: c.name.substring(6), rest: AnimProbe.rest(c)})
    }
    this.rootMoveCm = 0
    this.rootTurn = 0
    this.groupMove = {}
    this.groupScale = {}
    this.groupShown = []
    for (const g of this.groups) {
      this.groupMove[g.name] = 0
      this.groupScale[g.name] = 0
    }
    this.active = true
    return this.root.name
  }

  stop(): void {
    this.active = false
  }

  /** Largest difference from the captured rest pose right now (root cm/rad, groups units/rad). */
  restDelta(): {rootCm: number; rootRad: number; group: number; hiddenOk: boolean} {
    const r = this.root!.getTransform()
    let group = 0
    let hiddenOk = true
    for (const g of this.groups) {
      const t = g.so.getTransform()
      group = Math.max(group, t.getLocalPosition().distance(g.rest.pos), quat.angleBetween(t.getLocalRotation(), g.rest.rot))
      if (g.so.enabled !== g.rest.enabled) hiddenOk = false
    }
    return {
      rootCm: r.getLocalPosition().distance(this.rootRest!.pos) + Math.abs(r.getLocalScale().y - this.rootRest!.scale.y),
      rootRad: quat.angleBetween(r.getLocalRotation(), this.rootRest!.rot),
      group,
      hiddenOk,
    }
  }

  private sample(): void {
    if (!this.active || !this.root || !this.rootRest) return
    const r = this.root.getTransform()
    this.rootMoveCm = Math.max(this.rootMoveCm, r.getLocalPosition().distance(this.rootRest.pos))
    this.rootTurn = Math.max(this.rootTurn, quat.angleBetween(r.getLocalRotation(), this.rootRest.rot))
    for (const g of this.groups) {
      const t = g.so.getTransform()
      this.groupMove[g.name] = Math.max(this.groupMove[g.name], t.getLocalPosition().distance(g.rest.pos))
      this.groupScale[g.name] = Math.max(this.groupScale[g.name], Math.abs(t.getLocalScale().x / g.rest.scale.x - 1))
      if (g.so.enabled && !g.rest.enabled && this.groupShown.indexOf(g.name) < 0) this.groupShown.push(g.name)
    }
  }

  private static rest(so: SceneObject): Rest {
    const t = so.getTransform()
    return {pos: t.getLocalPosition(), rot: t.getLocalRotation(), scale: t.getLocalScale(), enabled: so.enabled}
  }
}

/** Each model's signature move, checked on top of "it moved and settled". */
function signatureOk(id: string, p: AnimProbe): {ok: boolean; what: string} {
  switch (id) {
    case "speech":
      return {ok: p.groupMove["mark"] > 0.1, what: `"?" pops out (moved ${(p.groupMove["mark"] || 0).toFixed(3)})`}
    case "magnifier":
      return {ok: p.groupScale["glass"] > 0.3, what: `lens zooms (scale +${((p.groupScale["glass"] || 0) * 100).toFixed(0)}%)`}
    case "bulb":
      return {ok: p.groupShown.indexOf("rays") >= 0, what: `rays light up (shown ${j(p.groupShown)})`}
    case "flask":
      return {ok: p.groupShown.indexOf("bubbles") >= 0, what: `bubbles rise (shown ${j(p.groupShown)})`}
    case "flag": {
      const cols = ["c0", "c1", "c2", "c3"].map((c) => p.groupMove[c] || 0)
      return {ok: cols.every((m) => m > 0.02), what: `all 4 cloth columns wave (${j(cols.map((m) => +m.toFixed(3)))})`}
    }
  }
  return {ok: false, what: "unknown model " + id}
}

@component
export class LociC10StudyPackScenario extends Scenario {
  async run(): Promise<void> {
    const main = await setupAtStart()

    // Start card: three packs, top to bottom; no voice button in the preview.
    const ys: number[] = []
    for (const b of START_BUTTONS) {
      expect(!!findInteractableByName(b.name, undefined, true), `${b.name} live on the start card`).toBe(true)
      const so = findSceneObjectByName(b.name)!
      const ec = so.getComponent(ElementContent.getTypeName()) as ElementContent
      expect(ec ? ec.text : "", `${b.name} label`).toBe(b.label)
      ys.push(so.getTransform().getWorldPosition().y)
    }
    log(`C10 start card: buttons=${j(START_BUTTONS.map((b) => b.name))} y=${j(ys.map((y) => +y.toFixed(1)))} voiceShown=${main.voiceButtonShown} sayMyList=${!!findSceneObjectByName("SayMyListButton")}`)
    expect(ys[0] > ys[1] && ys[1] > ys[2], "Study pack, Errands (warm-up), Mixed list from top to bottom").toBe(true)
    expect(main.voiceButtonShown, "preview start card leaves out Say my list").toBe(false)
    expect(!!findSceneObjectByName("SayMyListButton"), "no SayMyListButton in the preview").toBe(false)

    // Synonyms: every pack word and its object names match; near-misses stay totems.
    const got = SYNONYMS.map(([w]) => matchModel(w))
    log(`C10 synonyms: ${j(SYNONYMS.map(([w], i) => `${w}→${got[i]}`))}`)
    SYNONYMS.forEach(([w, want], i) => expect(got[i], `"${w}" matches`).toBe(want))

    // Step under test: Study pack.
    await pinch("StudyPackButton", main)
    await waitFor(() => main.phase === "building", 2000, "building after Study pack pinch", main)
    await waitFor(() => main.phase === "study" && main.currentSpotIndex === 0, 6000, "study at spot 1 after Study pack", main)
    await sleep(300)
    log(`C10 placed: source=${main.lastListSource} words=${j(main.listWords)} models=${j(main.placedModelIds)} order=${j(main.placementOrder)} totems=${j(main.totemTexts)}`)
    expect(main.lastListSource, "list source").toBe("study")
    expect(j(main.listWords), "the five steps in route order").toBe(j(["ask a question", "research", "hypothesis", "experiment", "conclusion"]))
    expect(j(main.placedModelIds), "study models in route order").toBe(j(STUDY_MODELS))
    expect(j(main.placementOrder), "dropped one at a time in route order").toBe(j([0, 1, 2, 3, 4]))
    expect(j(main.totemTexts), "no word totems").toBe(j(["", "", "", "", ""]))

    // Steps under test: the study walk — each step's name shows and its animation plays, then settles.
    const probe = new AnimProbe(this)
    for (let k = 0; k < 5; k++) {
      await waitFor(() => main.phase === "study" && main.currentSpotIndex === k, 5000, `study at spot ${k + 1}`, main)
      await sleep(250)
      const rootName = probe.arm(k)
      await pinch(`Spot${k + 1}_Item`, main)
      await waitFor(() => main.nameTagText === STUDY_LABELS[k], 1500, `name "${STUDY_LABELS[k]}" at spot ${k + 1}`, main)
      await sleep(1700) // STUDY_ANIM_SEC 1.4 s + margin
      probe.stop()
      const sig = signatureOk(STUDY_MODELS[k], probe)
      const rest = probe.restDelta()
      log(`C10 spot ${k + 1} ${rootName} "${main.nameTagText}": rootMove=${probe.rootMoveCm.toFixed(2)}cm rootTurn=${probe.rootTurn.toFixed(3)}rad groups=${j(probe.groupMove)} ${sig.what}; at rest after: ${j(rest)}`)
      expect(rootName, `spot ${k + 1} model`).toBe("Model_" + STUDY_MODELS[k])
      expect(probe.rootMoveCm > 0.5 || probe.rootTurn > 0.05, `${STUDY_MODELS[k]} animates (moved ${probe.rootMoveCm.toFixed(2)} cm, turned ${probe.rootTurn.toFixed(3)} rad)`).toBe(true)
      expect(sig.ok, `${STUDY_MODELS[k]}: ${sig.what}`).toBe(true)
      expect(rest.rootCm < 0.05 && rest.rootRad < 0.01 && rest.group < 0.005 && rest.hiddenOk, `${STUDY_MODELS[k]} settles back to rest ${j(rest)}`).toBe(true)
      if (k < 4) await waitFor(() => main.currentSpotIndex === k + 1, 5000, `pulse moves to spot ${k + 2}`, main)
    }
    await waitFor(() => main.phase === "switch" && main.cardView === "switch", 6000, "switch card after spot 5", main)
    await waitFor(() => !!findInteractableByName("QuizMeButton", undefined, true), 3000, "QuizMeButton enabled", main)
    await sleep(400)

    // Steps under test: Find-it asks for each step by name, with its icon.
    await pinchQuizMeAndWaitForPrompt(main)
    const prompts = await playFindIt(main, [])
    log(`C10 find-it: ${j(prompts.map((p) => `spot${p.target + 1} "${p.question}" icon=${p.icon}`))} score="${main.scoreText}"`)
    expect(prompts.length, "5 prompts").toBe(5)
    prompts.forEach((p, k) => {
      expect(p.question, `prompt ${k + 1} question`).toBe(STUDY_QUESTIONS[p.target])
      expect(p.icon, `prompt ${k + 1} icon`).toBe(STUDY_MODELS[p.target])
      expect(p.correct, `prompt ${k + 1} found first time`).toBe(true)
    })
    expect(main.scoreText, "all five steps found").toBe("5 / 5")
    log(`C10 PASS state=${main.getStateJson()}`)
  }
}
