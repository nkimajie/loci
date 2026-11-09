/**
 * LociPalaceBuilder — "Build my palace": the user pinches 5 places on real surfaces and
 * they become the route.
 *
 * Owns: listening for pinches while building, turning each pinch's interactor ray into a
 *       surface point, the 25 cm spacing rule, and the build visuals (numbered glowing
 *       spots joined in order by a thin bright line; a gentle shake on a rejected pinch).
 * Surfaces:
 *   - Lens Studio preview: the SIK interactor ray is raycast (Physics probe) against Box
 *     colliders on the table, chair and shelf stand-ins and an invisible floor. The
 *     colliders exist only while building, so they never block normal pinching.
 *   - Specs (when useWorldQuery is on): the same ray goes to World Query surface
 *     hit-testing first; the stand-in colliders are the fallback. The preview never uses
 *     World Query.
 * Only upward-facing hits count (objects rest on tops of things, not on walls or legs).
 * Pinches aimed at the card (its buttons) are ignored here.
 * API: begin(), clear(), setVisible(on); emits onSpotAdded(index), onRejected(info),
 *      onComplete(world positions). Test getters: count, localPositions, rejectCount,
 *      shakingIndices, lineCount, labels, isActive.
 * Must not: move the LociSpots or decide the flow — LociMain does.
 */

import {InteractorInputType, InteractorTriggerType} from "SpectaclesInteractionKit.lspkg/Core/Interactor/Interactor"
import {SIK} from "SpectaclesInteractionKit.lspkg/SIK"
import Event, {PublicApi} from "SpectaclesInteractionKit.lspkg/Utils/Event"
import {LociAudio} from "./LociAudio"
import {Rgb} from "./LociModelLibrary"
import {LociShapeKit} from "./LociShapeKit"
import {Ease, clamp01} from "./LociTween"

export const PALACE_SPOTS = 5
export const MIN_GAP_CM = 25
const RAY_LENGTH_CM = 1500
const UP_DOT_MIN = 0.5 // hit normal must face up (within ~60°)
const SURFACE_NAMES = ["TableTop", "ChairSeat", "ShelfTop", "ShelfBoard_1", "ShelfBoard_2"]
const SPOT_COLOR: Rgb = [0.35, 0.95, 1.0]
const LINE_COLOR: Rgb = [0.55, 1.0, 0.95]
const DISC_CM = 20
const LABEL_CM = 7
const LIFT_CM = 2
const POP_SEC = 0.35
const LINE_GROW_SEC = 0.3
const SHAKE_SEC = 0.5

export interface PalaceReject {
  /** "tooClose" (within MIN_GAP_CM of an existing spot) or "notSurface" (nothing flat hit). */
  reason: "tooClose" | "notSurface"
  /** Index of the existing spot it was too close to (-1 otherwise). */
  near: number
  distanceCm: number
}

interface BuildSpot {
  root: SceneObject
  local: vec3
  age: number
  shakeLeft: number
  label: Text3D | null
}

interface BuildLine {
  holder: SceneObject
  age: number
}

export interface PalaceBuilderDeps {
  owner: BaseScriptComponent
  kit: LociShapeKit
  audio: LociAudio
  palaceRoot: SceneObject
  eyeWorld: vec3
  /** Pinches on this object's descendants (the card) are ignored. */
  ignoreRoot: SceneObject
  /** Scale for numbers/lines so they read from the preview camera (1 on Specs). */
  viewScale: number
  useWorldQuery: boolean
  log: (msg: string) => void
}

export class LociPalaceBuilder {
  private d: PalaceBuilderDeps
  private root: SceneObject
  private surfaces: SceneObject[] = []
  private colliders: ColliderComponent[] = []
  private probe = Physics.createGlobalProbe()
  private spots: BuildSpot[] = []
  private lines: BuildLine[] = []
  private active = false
  private wasTriggering: {[k: string]: boolean} = {}
  private pending = false
  private _rejects = 0
  private hitSession: HitTestSession | null = null
  private discMat: Material
  private lineMat: Material

  private _onSpotAdded = new Event<number>()
  private _onRejected = new Event<PalaceReject>()
  private _onComplete = new Event<vec3[]>()

  get onSpotAdded(): PublicApi<number> {
    return this._onSpotAdded.publicApi()
  }

  get onRejected(): PublicApi<PalaceReject> {
    return this._onRejected.publicApi()
  }

  get onComplete(): PublicApi<vec3[]> {
    return this._onComplete.publicApi()
  }

  constructor(deps: PalaceBuilderDeps) {
    this.d = deps
    this.root = global.scene.createSceneObject("PalaceBuild")
    this.root.setParent(deps.palaceRoot)
    this.discMat = deps.kit.glowMaterialFor(SPOT_COLOR, 1.0)
    this.lineMat = deps.kit.glowMaterialFor(LINE_COLOR, 1.1)
    this.makeColliders()
    deps.owner.createEvent("LateUpdateEvent").bind(() => this.onLateUpdate())
  }

  // ── State (test-facing) ───────────────────────────────────────────────────

  get isActive(): boolean {
    return this.active
  }

  get count(): number {
    return this.spots.length
  }

  /** Spot positions in palace-root (room) space, in pinch order. */
  get localPositions(): vec3[] {
    return this.spots.map((s) => s.local)
  }

  get worldPositions(): vec3[] {
    const m = this.d.palaceRoot.getTransform().getWorldTransform()
    return this.spots.map((s) => m.multiplyPoint(s.local))
  }

  get rejectCount(): number {
    return this._rejects
  }

  get shakingIndices(): number[] {
    const out: number[] = []
    this.spots.forEach((s, i) => {
      if (s.shakeLeft > 0) out.push(i)
    })
    return out
  }

  get lineCount(): number {
    return this.lines.length
  }

  get labels(): string[] {
    return this.spots.map((s) => (s.label ? s.label.text : ""))
  }

  get visible(): boolean {
    return this.root.enabled
  }

  // ── Control ──────────────────────────────────────────────────────────────

  /** Starts a fresh palace: clears old spots, turns the surface colliders on, listens for pinches. */
  begin(): void {
    this.clear()
    this.active = true
    this.root.enabled = true
    this.setCollidersOn(true)
    this.wasTriggering = {}
    // Don't count a pinch that is still held from the button press that started building.
    for (const it of this.interactors()) this.wasTriggering[it.key] = it.triggering
    this.d.log(`palace build: listening (${global.deviceInfoSystem.isEditor() || !this.d.useWorldQuery ? "stand-in colliders" : "World Query, stand-ins as fallback"})`)
  }

  /** Removes every build spot and line and stops listening. */
  clear(): void {
    this.active = false
    this.pending = false
    this.setCollidersOn(false)
    for (const s of this.spots) s.root.destroy()
    for (const l of this.lines) l.holder.destroy()
    this.spots = []
    this.lines = []
    this._rejects = 0
  }

  setVisible(on: boolean): void {
    this.root.enabled = on
  }

  // ── Pinch → ray → surface ────────────────────────────────────────────────

  private interactors(): {key: string; triggering: boolean; start: vec3 | null; dir: vec3 | null; onCard: boolean}[] {
    const out: {key: string; triggering: boolean; start: vec3 | null; dir: vec3 | null; onCard: boolean}[] = []
    const list = SIK.InteractionManager.getInteractorsByType(InteractorInputType.All)
    list.forEach((it, i) => {
      let onCard = false
      try {
        const target = it.currentInteractable
        onCard = !!target && target.getSceneObject().isDescendantOf(this.d.ignoreRoot)
      } catch (e) {
        onCard = false // target destroyed mid-frame
      }
      out.push({
        key: `${it.inputType}:${i}`,
        triggering: it.currentTrigger !== InteractorTriggerType.None,
        start: it.startPoint,
        dir: it.direction,
        onCard,
      })
    })
    return out
  }

  private onLateUpdate(): void {
    const dt = getDeltaTime()
    this.animate(dt)
    if (!this.active) return
    for (const it of this.interactors()) {
      const was = !!this.wasTriggering[it.key]
      this.wasTriggering[it.key] = it.triggering
      if (!it.triggering || was || it.onCard || this.pending) continue
      if (!it.start || !it.dir) continue
      this.castRay(it.start, it.dir.normalize())
    }
  }

  private castRay(start: vec3, dir: vec3): void {
    const end = start.add(dir.uniformScale(RAY_LENGTH_CM))
    this.pending = true
    if (this.d.useWorldQuery && !global.deviceInfoSystem.isEditor()) {
      const session = this.worldQuery()
      if (session) {
        session.hitTest(start, end, (hit: WorldQueryHitTestResult) => {
          if (hit) this.consider(hit.position, hit.normal, "World Query")
          else this.castStandIns(start, end)
        })
        return
      }
    }
    this.castStandIns(start, end)
  }

  private castStandIns(start: vec3, end: vec3): void {
    this.probe.rayCastAll(start, end, (hits: RayCastHit[]) => {
      for (const h of hits) {
        const so = h.collider ? h.collider.getSceneObject() : null
        if (so && this.surfaces.some((s) => s.isSame(so))) {
          this.consider(h.position, h.normal, so.name)
          return
        }
      }
      this.consider(null, null, "nothing")
    })
  }

  private worldQuery(): HitTestSession | null {
    if (this.hitSession) return this.hitSession
    try {
      const wq = require("LensStudio:WorldQueryModule") as WorldQueryModule
      const opts = HitTestSessionOptions.create()
      opts.filter = true
      this.hitSession = wq.createHitTestSessionWithOptions(opts)
      this.hitSession.start()
    } catch (e) {
      this.d.log("palace build: World Query unavailable, using stand-ins: " + e)
      this.hitSession = null
    }
    return this.hitSession
  }

  private consider(pos: vec3 | null, normal: vec3 | null, what: string): void {
    this.pending = false
    if (!this.active) return
    const roomT = this.d.palaceRoot.getTransform()
    if (!pos || !normal || normal.normalize().dot(roomT.up) < UP_DOT_MIN) {
      this._rejects += 1
      const detail = pos && normal ? ` at ${roomT.getInvertedWorldTransform().multiplyPoint(pos).toString()} normal ${normal.toString()} (room up ${roomT.up.toString()})` : ""
      this.d.log(`palace build: pinch hit ${what}${pos ? " (not facing up)" : ""}${detail} — ignored`)
      this._onRejected.invoke({reason: "notSurface", near: -1, distanceCm: 0})
      return
    }
    const local = roomT.getInvertedWorldTransform().multiplyPoint(pos)
    let near = -1
    let nearDist = Number.MAX_VALUE
    this.spots.forEach((s, i) => {
      const dd = s.local.distance(local)
      if (dd < nearDist) {
        nearDist = dd
        near = i
      }
    })
    if (near >= 0 && nearDist < MIN_GAP_CM) {
      this._rejects += 1
      this.spots[near].shakeLeft = SHAKE_SEC
      this.d.audio.whoosh(pos)
      this.d.log(`palace build: ${nearDist.toFixed(1)} cm from place ${near + 1} — too close, rejected`)
      this._onRejected.invoke({reason: "tooClose", near, distanceCm: nearDist})
      return
    }
    const index = this.spots.length
    this.addSpot(local, index)
    if (index > 0) this.addLine(this.spots[index - 1].local, local)
    this.d.audio.spotChime(index, pos)
    this.d.log(`palace build: place ${index + 1} on ${what} at room ${local.toString()}`)
    this._onSpotAdded.invoke(index)
    if (this.spots.length >= PALACE_SPOTS) {
      this.active = false
      this.setCollidersOn(false)
      this._onComplete.invoke(this.worldPositions)
    }
  }

  // ── Visuals ──────────────────────────────────────────────────────────────

  private addSpot(local: vec3, index: number): void {
    const kit = this.d.kit
    const root = global.scene.createSceneObject(`PalaceSpot${index + 1}`)
    root.setParent(this.root)
    root.getTransform().setLocalPosition(local)
    root.getTransform().setLocalScale(vec3.one().uniformScale(0.001))
    kit.part(root, "Disc", "disc", new vec3(0, 0.4, 0), new vec3(DISC_CM, 0, DISC_CM), null, this.discMat)
    kit.part(root, "DiscCore", "disc", new vec3(0, 0.5, 0), new vec3(DISC_CM * 0.45, 0, DISC_CM * 0.45), null, this.discMat)
    const vs = this.d.viewScale
    const pinH = 6 + LABEL_CM * vs * 0.3
    kit.part(root, "Pin", "cylinder", new vec3(0, pinH / 2, 0), new vec3(0.5 * vs, pinH, 0.5 * vs), null, this.lineMat)
    const label = this.makeLabel(root, `${index + 1}`, new vec3(0, pinH + (LABEL_CM * vs) / 2 + 1, 0), LABEL_CM * vs)
    this.spots.push({root, local, age: 0, shakeLeft: 0, label})
  }

  private makeLabel(parent: SceneObject, text: string, localPos: vec3, heightCm: number): Text3D | null {
    const tpl = this.d.kit.totemTextTemplate
    if (!tpl) return null
    const so = global.scene.createSceneObject("Number")
    so.setParent(parent)
    so.getTransform().setLocalPosition(localPos)
    const worldPos = so.getTransform().getWorldPosition()
    const toEye = this.d.eyeWorld.sub(worldPos)
    const flat = new vec3(toEye.x, 0, toEye.z)
    if (flat.length > 0.001) so.getTransform().setWorldRotation(quat.lookAt(flat.normalize(), vec3.up()))
    const t3 = so.copyComponent(tpl) as Text3D
    t3.enabled = true
    t3.text = text
    const w = heightCm * 1.4
    t3.layoutRect = Rect.create(-w / 2, w / 2, -heightCm / 2, heightCm / 2)
    t3.horizontalOverflow = HorizontalOverflow.Shrink
    t3.verticalOverflow = VerticalOverflow.Shrink
    t3.sizeToFit = true
    t3.size = Math.round(heightCm * 50)
    t3.extrusionDepth = 0.25
    const mat = t3.mainMaterial.clone()
    const pass = mat.mainPass as any
    const c = new vec4(1, 1, 1, 1)
    const edge = new vec4(SPOT_COLOR[0], SPOT_COLOR[1], SPOT_COLOR[2], 1)
    for (const k of ["frontCapStartingColor", "frontCapEndingColor", "backCapStartingColor", "backCapEndingColor"]) pass[k] = c
    for (const k of ["outerEdgeStartingColor", "outerEdgeEndingColor", "InnerEdgeStartingColor", "InnerEdgeEndingColor"]) pass[k] = edge
    t3.mainMaterial = mat
    return t3
  }

  private addLine(a: vec3, b: vec3): void {
    const up = new vec3(0, LIFT_CM, 0)
    const pa = a.add(up)
    const pb = b.add(up)
    const seg = pb.sub(pa)
    const len = seg.length
    if (len < 0.1) return
    const holder = global.scene.createSceneObject(`PalaceLine${this.lines.length + 1}`)
    holder.setParent(this.root)
    holder.getTransform().setLocalPosition(pa)
    holder.getTransform().setLocalRotation(quat.rotationFromTo(vec3.up(), seg.normalize()))
    holder.getTransform().setLocalScale(new vec3(1, 0.001, 1))
    const thick = 0.4 + 0.6 * this.d.viewScale
    this.d.kit.part(holder, "Line", "cylinder", new vec3(0, len / 2, 0), new vec3(thick, len, thick), null, this.lineMat)
    this.lines.push({holder, age: 0})
  }

  private animate(dt: number): void {
    for (const s of this.spots) {
      s.age += dt
      const pop = Math.max(0.001, Ease.outBack(clamp01(s.age / POP_SEC)))
      s.root.getTransform().setLocalScale(vec3.one().uniformScale(pop))
      let dx = 0
      if (s.shakeLeft > 0) {
        s.shakeLeft = Math.max(0, s.shakeLeft - dt)
        const u = 1 - s.shakeLeft / SHAKE_SEC
        dx = Math.sin(u * Math.PI * 6) * 1.8 * (1 - u)
      }
      s.root.getTransform().setLocalPosition(s.local.add(new vec3(dx, 0, 0)))
    }
    for (const l of this.lines) {
      l.age += dt
      const g = Math.max(0.001, Ease.outQuad(clamp01(l.age / LINE_GROW_SEC)))
      l.holder.getTransform().setLocalScale(new vec3(1, g, 1))
    }
  }

  // ── Stand-in colliders ─────────────────────────────────────────────────────

  private makeColliders(): void {
    const found: SceneObject[] = []
    const walk = (so: SceneObject) => {
      if (SURFACE_NAMES.indexOf(so.name) >= 0) found.push(so)
      for (let i = 0; i < so.getChildrenCount(); i++) walk(so.getChild(i))
    }
    walk(this.d.palaceRoot)
    for (const so of found) {
      const c = so.createComponent("Physics.ColliderComponent") as ColliderComponent
      c.shape = Shape.createBoxShape()
      c.fitVisual = true
      c.enabled = false
      this.surfaces.push(so)
      this.colliders.push(c)
    }
    // Invisible floor under the whole room (the stand-ins have no floor mesh).
    const floor = global.scene.createSceneObject("PalaceFloor")
    floor.setParent(this.d.palaceRoot)
    floor.getTransform().setLocalPosition(new vec3(0, -0.5, -100))
    const fc = floor.createComponent("Physics.ColliderComponent") as ColliderComponent
    const box = Shape.createBoxShape()
    box.size = new vec3(600, 1, 600)
    fc.shape = box
    fc.fitVisual = false
    fc.enabled = false
    this.surfaces.push(floor)
    this.colliders.push(fc)
    this.d.log(`palace build: ${this.surfaces.length} surfaces (${this.surfaces.map((s) => s.name).join(", ")})`)
  }

  private setCollidersOn(on: boolean): void {
    for (const c of this.colliders) c.enabled = on
  }
}
