/**
 * LociSpot — one anchor spot on the route (chair, table left, table centre,
 * table right, shelf). Attached to the authored "SpotN_<Place>" SceneObject, whose
 * position IS the surface point the object rests on (move it in the scene to re-place).
 *
 * Owns: the runtime pinch target "SpotN_Item" (unit-scale collider wrapper +
 *       SIK Interactable), the object visual under it (model or word totem), the
 *       glow discs, the Find-it feedback ring, and this spot's drop / pulse / hover /
 *       shrink / reveal / wrong-shake visuals.
 * Expects @inputs: its LociMarkerUI ("SpotN_Marker").
 * API: setup(), setItem(), dropIn(), clearItem(), setPinchable(), setPulse(),
 *      setGlow(), playStudyAnimation(), shrinkToMarker(), reveal(), setMarkerPulse(),
 *      showRing(), clearRing(), shakeWrong(), relocate(worldPos) (Build my palace);
 *      emits onItemPinched(index) / onMarkerPinched(index).
 * Must not: decide flow or order — LociMain owns the session.
 */

import {Interactable} from "SpectaclesInteractionKit.lspkg/Components/Interaction/Interactable/Interactable"
import Event, {PublicApi} from "SpectaclesInteractionKit.lspkg/Utils/Event"
import {LociAudio} from "./LociAudio"
import {LociMarkerUI} from "./LociMarkerUI"
import {BuiltModel, buildModel, buildTotem, poseModel, resetPose} from "./LociModelBuilder"
import {Rgb, findModel} from "./LociModelLibrary"
import {ListItem} from "./LociParser"
import {LociShapeKit} from "./LociShapeKit"
import {Ease, TweenHandle, Tweener} from "./LociTween"

export type GlowMode = "off" | "steady" | "missed" | "neutral"
export type RingKind = "" | "green" | "orange"

const GLOW_COLOR: Rgb = [1.0, 0.82, 0.38]
const MISSED_COLOR: Rgb = [1.0, 0.48, 0.32]
const NEUTRAL_COLOR: Rgb = [0.7, 0.82, 1.0] // Find-it: every hidden spot glows the same
const WRONG_COLOR: Rgb = [1.0, 0.16, 0.18]
const RING_COLORS: {[k: string]: Rgb} = {green: [0.2, 1.0, 0.42], orange: [1.0, 0.55, 0.1]}
const STUDY_ANIM_SEC = 1.4
const DROP_HEIGHT_CM = 28
const RING_POP_SEC = 0.3
const RING_FADE_SEC = 0.4

@component
export class LociSpot extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">LociSpot – one route spot: object, glow, pulse and its "?" marker</span>')
  @ui.separator
  @ui.label('<span style="color: #60A5FA;">References</span>')
  @ui.group_start("References")
  @input
  @hint("This spot's '?' marker (LociMarkerUI on SpotN_Marker)")
  marker!: LociMarkerUI
  @ui.group_end

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Settings</span>')
  @ui.group_start("Settings")
  @input
  @hint("Route position 1..5 (chair = 1, shelf = 5)")
  @widget(new SliderWidget(1, 5, 1))
  spotNumber: number = 1

  @input
  @hint("Readable spot name used in logs and tests")
  spotName: string = "Chair"

  @input
  @hint("Nominal object size at this spot in cm (brief: chair 30, table sides 15, centre 20, shelf 20)")
  @widget(new SliderWidget(8, 40, 1))
  objectSizeCm: number = 20
  @ui.group_end

  private kit: LociShapeKit | null = null
  private audio: LociAudio | null = null
  private tween!: Tweener
  private eyeWorld: vec3 = new vec3(0, 0, 0)

  private itemRoot!: SceneObject
  private visual!: SceneObject
  private glowRoot!: SceneObject
  private glowMats: Material[] = []
  private collider!: ColliderComponent
  private interactable!: Interactable

  private built: BuiltModel | null = null
  private item: ListItem | null = null
  private _placed = false
  private _revealed = false
  private _pinchable = false
  private pulsing = false
  private pulsePhase = 0
  private hovered = false
  private hoverMix = 0
  private glowMode: GlowMode = "off"
  private glowLevel = 0
  private appear = 0
  private dropY = 0
  private squash = 0
  private appearTween: TweenHandle | null = null
  private animTween: TweenHandle | null = null
  private _placedAt = -1

  private ringRoot!: SceneObject
  private ringMat: Material | null = null
  private ring: RingKind = ""
  private ringAge = 0
  private ringHold = 0
  private wrongLeft = 0

  private _onItemPinched = new Event<number>()
  private _onMarkerPinched = new Event<number>()

  get onItemPinched(): PublicApi<number> {
    return this._onItemPinched.publicApi()
  }

  get onMarkerPinched(): PublicApi<number> {
    return this._onMarkerPinched.publicApi()
  }

  /** 0-based route index. */
  get index(): number {
    return Math.round(this.spotNumber) - 1
  }

  get itemSceneObject(): SceneObject {
    return this.itemRoot
  }

  get isPlaced(): boolean {
    return this._placed
  }

  get placedAt(): number {
    return this._placedAt
  }

  /** Model id placed here ("umbrella", "key", … or "totem"); "" when nothing is placed. */
  get placedModelId(): string {
    return this._placed && this.built ? this.built.modelId : ""
  }

  get totemText(): string {
    return this._placed && this.built ? this.built.totemText : ""
  }

  get listItem(): ListItem | null {
    return this.item
  }

  /** True while this spot's object or its marker is the one pulsing. */
  get isPulsing(): boolean {
    return (this.pulsing && this._placed && this._revealed) || (this.marker ? this.marker.isPulsing : false)
  }

  get isGlowing(): boolean {
    return this.glowMode !== "off"
  }

  get currentGlowMode(): GlowMode {
    return this.glowMode
  }

  get isRevealed(): boolean {
    return this._placed && this._revealed
  }

  get isMarkerVisible(): boolean {
    return this.marker ? this.marker.isVisible : false
  }

  get isPinchable(): boolean {
    return this._pinchable
  }

  /** Feedback ring currently showing ("" when none). */
  get ringKind(): RingKind {
    return this.ring
  }

  /** True while the red wrong-spot shake / flash is playing. */
  get isShaking(): boolean {
    return this.wrongLeft > 0 || (this.marker ? this.marker.isShaking : false)
  }

  onAwake(): void {
    const n = Math.round(this.spotNumber)
    const size = this.objectSizeCm

    this.itemRoot = global.scene.createSceneObject(`Spot${n}_Item`)
    this.itemRoot.setParent(this.sceneObject)
    this.itemRoot.getTransform().setLocalPosition(new vec3(0, size / 2, 0))

    this.collider = this.itemRoot.createComponent("Physics.ColliderComponent") as ColliderComponent
    const shape = Shape.createBoxShape()
    shape.size = new vec3(size * 1.15, size * 1.1, size * 1.15)
    this.collider.shape = shape
    this.collider.fitVisual = false
    this.collider.enabled = false
    this.interactable = this.itemRoot.createComponent(Interactable.getTypeName()) as Interactable

    this.visual = global.scene.createSceneObject(`Spot${n}_Visual`)
    this.visual.setParent(this.itemRoot)
    this.visual.getTransform().setLocalPosition(new vec3(0, -size / 2, 0))
    this.visual.getTransform().setLocalScale(vec3.one().uniformScale(0.001))

    this.glowRoot = global.scene.createSceneObject(`Spot${n}_Glow`)
    this.glowRoot.setParent(this.sceneObject)
    this.glowRoot.getTransform().setLocalPosition(new vec3(0, 0.4, 0))
    this.glowRoot.enabled = false

    this.ringRoot = global.scene.createSceneObject(`Spot${n}_Ring`)
    this.ringRoot.setParent(this.sceneObject)
    this.ringRoot.getTransform().setLocalPosition(new vec3(0, size / 2, 0))
    this.ringRoot.enabled = false

    this.tween = new Tweener(this)
    this.createEvent("OnStartEvent").bind(() => {
      this.interactable.onTriggerEnd.add(() => {
        if (this._pinchable) this._onItemPinched.invoke(this.index)
      })
      this.interactable.onHoverEnter.add(() => (this.hovered = true))
      this.interactable.onHoverExit.add(() => (this.hovered = false))
      if (this.marker) this.marker.onPinched.add(() => this._onMarkerPinched.invoke(this.index))
    })
    this.createEvent("UpdateEvent").bind(() => this.onUpdate())
  }

  /** Called once by LociMain after the palace is aligned to the user. */
  setup(kit: LociShapeKit, audio: LociAudio, eyeWorld: vec3): void {
    this.kit = kit
    this.audio = audio
    this.eyeWorld = eyeWorld

    // Objects face the user (yaw only); marker and feedback ring face the eyes.
    this.visual.getTransform().setWorldRotation(this.yawToEye(this.itemRoot.getTransform().getWorldPosition()))
    if (this.marker) this.faceEye(this.marker.getSceneObject())
    this.faceEye(this.ringRoot)

    if (this.glowMats.length === 0) {
      const size = this.objectSizeCm
      const inner = kit.glowMaterialFor(GLOW_COLOR, 0)
      const outer = kit.glowMaterialFor(GLOW_COLOR, 0)
      const di = Math.min(size * 1.25, 32)
      const dout = Math.min(size * 1.55, 38)
      kit.part(this.glowRoot, `Spot${this.spotNumber}_GlowInner`, "disc", vec3.zero(), new vec3(di, 0, di), null, inner)
      kit.part(this.glowRoot, `Spot${this.spotNumber}_GlowOuter`, "disc", new vec3(0, -0.1, 0), new vec3(dout, 0, dout), null, outer)
      this.glowMats = [inner, outer]
    }
    if (!this.ringMat) {
      // Upright ring around the object, facing the eyes, so it reads from any distance.
      const size = this.objectSizeCm
      const d = Math.max(20, Math.min(size * 1.55, 48))
      const thick = Math.max(2, size * 0.09)
      this.ringMat = kit.glowMaterialFor(RING_COLORS.green, 0)
      kit.part(this.ringRoot, `Spot${this.spotNumber}_RingTorus`, "torus", vec3.zero(), new vec3(d, thick, d), new vec3(90, 0, 0), this.ringMat)
    }
  }

  /**
   * Build my palace: moves this spot (object, marker, glow, ring and pinch target) so its
   * surface point is `worldPos`, then re-aims everything at the user's eyes.
   */
  relocate(worldPos: vec3): void {
    this.sceneObject.getTransform().setWorldPosition(worldPos)
    if (this.kit && this.audio) this.setup(this.kit, this.audio, this.eyeWorld)
  }

  // ── Positions for guides / labels ───────────────────────────────────────

  get surfaceWorldPos(): vec3 {
    return this.sceneObject.getTransform().getWorldPosition()
  }

  get itemCenterWorldPos(): vec3 {
    return this.itemRoot.getTransform().getWorldPosition()
  }

  get arrowWorldPos(): vec3 {
    return this.surfaceWorldPos.add(new vec3(0, this.objectSizeCm + 11, 0))
  }

  get markerArrowWorldPos(): vec3 {
    const m = this.marker ? this.marker.getSceneObject().getTransform().getWorldPosition() : this.surfaceWorldPos
    return m.add(new vec3(0, 11, 0))
  }

  get nameTagWorldPos(): vec3 {
    return this.surfaceWorldPos.add(new vec3(0, this.objectSizeCm + 6, 0))
  }

  facingRotation(worldPos: vec3): quat {
    const dir = this.eyeWorld.sub(worldPos)
    if (dir.length < 0.001) return quat.quatIdentity()
    return quat.lookAt(dir.normalize(), vec3.up())
  }

  // ── Item lifecycle ───────────────────────────────────────────────────────

  setItem(item: ListItem): void {
    this.clearItem()
    if (!this.kit) {
      print(`LociSpot ${this.spotName}: setup() not called before setItem()`)
      return
    }
    this.item = item
    const def = item.modelId ? findModel(item.modelId) : null
    this.built = def
      ? buildModel(this.kit, this.visual, def, this.objectSizeCm)
      : buildTotem(this.kit, this.visual, item.word, this.index, this.objectSizeCm)
    this.appear = 0
    this._placed = false
    this._revealed = false
  }

  clearItem(): void {
    if (this.appearTween) this.appearTween.cancel()
    if (this.animTween) this.animTween.cancel()
    this.tween.cancelAll()
    if (this.built) this.built.root.destroy()
    this.built = null
    this.item = null
    this._placed = false
    this._revealed = false
    this._placedAt = -1
    this.appear = 0
    this.dropY = 0
    this.squash = 0
    this.pulsing = false
    this.setPinchable(false)
    this.setGlow("off")
    this.clearRing()
    this.wrongLeft = 0
    if (this.marker) {
      this.marker.setPulsing(false)
      this.marker.popOut()
    }
  }

  /** Drops the object onto the spot with a bounce and a chime from the spot. */
  dropIn(): void {
    if (!this.built) return
    this._placed = true
    this._revealed = true
    this._placedAt = getTime()
    this.appear = 1
    this.dropY = DROP_HEIGHT_CM
    if (this.appearTween) this.appearTween.cancel()
    this.appearTween = this.tween.tween(
      0.38,
      (t) => {
        this.dropY = DROP_HEIGHT_CM * (1 - Ease.inQuad(t))
      },
      () => {
        this.dropY = 0
        const pos = this.surfaceWorldPos
        if (this.audio) {
          this.audio.drop(pos)
          this.audio.spotChime(this.index, pos)
        }
        this.appearTween = this.tween.tween(0.45, (t) => {
          this.squash = Math.sin(t * Math.PI * 2) * 0.22 * (1 - t)
          this.dropY = Math.max(0, Math.sin(t * Math.PI) * 4 * (1 - t))
        }, () => {
          this.squash = 0
          this.dropY = 0
        })
      },
    )
  }

  setPinchable(on: boolean): void {
    this._pinchable = on
    if (this.collider) this.collider.enabled = on
    if (!on) this.hovered = false
  }

  setPulse(on: boolean): void {
    this.pulsing = on
    if (on) this.pulsePhase = 0
  }

  setGlow(mode: GlowMode): void {
    this.glowMode = mode
  }

  setMarkerPulse(on: boolean): void {
    if (this.marker) this.marker.setPulsing(on)
  }

  playStudyAnimation(): void {
    const b = this.built
    if (!b) return
    if (this.animTween) this.animTween.cancel()
    this.animTween = this.tween.tween(STUDY_ANIM_SEC, (t) => poseModel(b, t), () => resetPose(b))
  }

  /** Object shrinks away and its "?" marker pops up in its place. */
  shrinkToMarker(): void {
    if (this.audio) this.audio.whoosh(this.surfaceWorldPos)
    if (this.appearTween) this.appearTween.cancel()
    const from = this.appear
    this.appearTween = this.tween.tween(
      0.35,
      (t) => {
        this.appear = from * (1 - Ease.inQuad(t))
      },
      () => {
        this.appear = 0
        this._revealed = false
        if (this.marker) this.marker.popIn()
      },
    )
  }

  /** Marker pops away and the object pops back into its place. */
  reveal(playPop: boolean = true): void {
    if (this.marker) {
      this.marker.setPulsing(false)
      this.marker.popOut()
    }
    this._revealed = true
    if (playPop && this.audio) this.audio.pop(this.surfaceWorldPos)
    if (this.appearTween) this.appearTween.cancel()
    this.appearTween = this.tween.tween(0.45, (t) => {
      this.appear = Ease.outBack(t)
    }, () => (this.appear = 1))
  }

  /** Find-it feedback ring around the object: pops in, holds `holdSec`, then fades. */
  showRing(kind: "green" | "orange", holdSec: number): void {
    this.ring = kind
    this.ringAge = 0
    this.ringHold = Math.max(0, holdSec)
    if (this.ringMat) LociShapeKit.setGlow(this.ringMat, RING_COLORS[kind], 0)
    this.ringRoot.getTransform().setLocalScale(vec3.one().uniformScale(0.001))
    this.ringRoot.enabled = true
  }

  clearRing(): void {
    this.ring = ""
    if (this.ringRoot) this.ringRoot.enabled = false
  }

  /** Find-it: this spot was pinched for the wrong item — marker shakes red, spot flashes red. */
  shakeWrong(sec: number): void {
    this.wrongLeft = sec
    if (this.marker) this.marker.shakeWrong(sec)
  }

  // ── Per-frame visuals ─────────────────────────────────────────────────────

  private onUpdate(): void {
    const dt = getDeltaTime()
    const visible = this._placed && this._revealed
    const markerPulsing = this.marker ? this.marker.isPulsing : false
    const anyPulse = (this.pulsing && visible) || markerPulsing
    let pulseMul = 1
    if (anyPulse) this.pulsePhase += dt * Math.PI * 2 * 1.1
    if (this.pulsing && visible) pulseMul = 1 + 0.08 * (0.5 + 0.5 * Math.sin(this.pulsePhase))
    const hoverTarget = this.hovered && this._pinchable ? 1 : 0
    this.hoverMix += (hoverTarget - this.hoverMix) * Math.min(1, dt * 12)
    const s = Math.max(0.001, this.appear * pulseMul * (1 + 0.12 * this.hoverMix))
    const q = this.squash
    const vt = this.visual.getTransform()
    vt.setLocalScale(new vec3(s * (1 + q * 0.5), s * (1 - q), s * (1 + q * 0.5)))
    vt.setLocalPosition(new vec3(0, -this.objectSizeCm / 2 + this.dropY, 0))

    // Glow: pulse (current), steady (group glow), missed (results), neutral (Find-it),
    // with a red flash over all of them while a wrong pinch shakes this spot.
    let target = 0
    let color = GLOW_COLOR
    if (this.glowMode === "steady") target = 1
    else if (this.glowMode === "missed") {
      target = 1
      color = MISSED_COLOR
    } else if (this.glowMode === "neutral") {
      target = 0.75
      color = NEUTRAL_COLOR
    } else if (anyPulse) target = 0.4 + 0.35 * Math.sin(this.pulsePhase)
    if (this.wrongLeft > 0) {
      this.wrongLeft = Math.max(0, this.wrongLeft - dt)
      target = 1.3
      color = WRONG_COLOR
    }
    target = Math.min(1.3, target + 0.4 * this.hoverMix)
    this.glowLevel += (target - this.glowLevel) * Math.min(1, dt * 8)
    const on = this.glowLevel > 0.01
    if (this.glowRoot.enabled !== on) this.glowRoot.enabled = on
    if (on && this.glowMats.length === 2) {
      LociShapeKit.setGlow(this.glowMats[0], color, 0.55 * this.glowLevel)
      LociShapeKit.setGlow(this.glowMats[1], color, 0.22 * this.glowLevel)
    }
    this.updateRing(dt)
  }

  private updateRing(dt: number): void {
    if (this.ring === "" || !this.ringMat) return
    this.ringAge += dt
    const a = this.ringAge
    let scale = 1
    let level = 1
    if (a < RING_POP_SEC) scale = 0.55 + 0.45 * Ease.outBack(a / RING_POP_SEC)
    const fadeStart = RING_POP_SEC + this.ringHold
    if (a > fadeStart) level = Math.max(0, 1 - (a - fadeStart) / RING_FADE_SEC)
    this.ringRoot.getTransform().setLocalScale(vec3.one().uniformScale(Math.max(0.001, scale)))
    LociShapeKit.setGlow(this.ringMat, RING_COLORS[this.ring], 1.15 * level)
    if (level <= 0) this.clearRing()
  }

  private yawToEye(from: vec3): quat {
    const d = this.eyeWorld.sub(from)
    const flat = new vec3(d.x, 0, d.z)
    if (flat.length < 0.001) return quat.quatIdentity()
    return quat.lookAt(flat.normalize(), vec3.up())
  }

  private faceEye(obj: SceneObject): void {
    const t = obj.getTransform()
    t.setWorldRotation(this.facingRotation(t.getWorldPosition()))
  }
}
