/**
 * LociGuide — the route arrow that hovers over the current spot, and the small
 * edge arrow beside the card that points the way when that spot is out of view.
 *
 * Owns: both arrows' geometry (simple shapes), their motion and visibility.
 * Expects @inputs: an authored anchor near the card for the edge arrow.
 * API: setup(kit, camera), pointAt(worldPos), hide(); getters isVisible /
 *      edgeArrowVisible / targetWorldPos.
 * Must not: decide which spot is current — LociMain tells it.
 */

import {Rgb} from "./LociModelLibrary"
import {LociShapeKit} from "./LociShapeKit"
import {Ease, TweenHandle, Tweener} from "./LociTween"

@component
export class LociGuide extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">LociGuide – route arrow over the current spot + edge hint for off-screen spots</span>')
  @ui.separator
  @ui.label('<span style="color: #60A5FA;">References</span>')
  @ui.group_start("References")
  @input
  @hint("Authored point near the card where the small edge arrow appears")
  edgeArrowAnchor!: SceneObject
  @ui.group_end

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Settings</span>')
  @ui.group_start("Settings")
  @input("vec3", "{1.0, 0.84, 0.3}")
  @hint("Arrow colour (bright — the display is additive)")
  @widget(new ColorWidget())
  arrowColor: vec3 = new vec3(1.0, 0.84, 0.3)

  @input
  @hint("How far the route arrow bobs up and down, in cm")
  @widget(new SliderWidget(0, 5, 0.25))
  bobAmountCm: number = 1.5

  @input
  @hint("A spot further than this angle from where you look counts as out of view (degrees)")
  @widget(new SliderWidget(8, 45, 1))
  viewHalfAngleDeg: number = 20
  @ui.group_end

  private tween!: Tweener
  private camera: SceneObject | null = null
  private routeArrow!: SceneObject
  private edgeArrow!: SceneObject
  private visible = false
  private _edgeVisible = false
  // Stored in this object's local space (a child of the room) so they follow the room.
  private target: vec3 = vec3.zero()
  private basePos: vec3 = vec3.zero()
  private moveTween: TweenHandle | null = null
  private phase = 0
  private built = false

  get isVisible(): boolean {
    return this.visible
  }

  get edgeArrowVisible(): boolean {
    return this._edgeVisible
  }

  get targetWorldPos(): vec3 {
    return this.toWorld(this.target)
  }

  onAwake(): void {
    this.tween = new Tweener(this)
    this.routeArrow = global.scene.createSceneObject("RouteArrow")
    this.routeArrow.setParent(this.sceneObject)
    this.routeArrow.enabled = false
    this.edgeArrow = global.scene.createSceneObject("EdgeArrow")
    this.edgeArrow.setParent(this.sceneObject)
    this.edgeArrow.enabled = false
    this.createEvent("UpdateEvent").bind(() => this.onUpdate())
  }

  setup(kit: LociShapeKit, camera: SceneObject | null): void {
    this.camera = camera
    if (this.built) return
    this.built = true
    const c: Rgb = [this.arrowColor.x, this.arrowColor.y, this.arrowColor.z]
    const mat = kit.glowMaterialFor(c, 1.0)
    // Route arrow: tip at local origin pointing down, shaft above it.
    kit.part(this.routeArrow, "RouteArrowHead", "cone", new vec3(0, 2, 0), new vec3(4, 4, 4), new vec3(180, 0, 0), mat)
    kit.part(this.routeArrow, "RouteArrowShaft", "cylinder", new vec3(0, 6.5, 0), new vec3(1.5, 5, 1.5), null, mat)
    // Edge arrow: points along local +Z.
    kit.part(this.edgeArrow, "EdgeArrowHead", "cone", new vec3(0, 0, 1.5), new vec3(3, 3, 3), new vec3(90, 0, 0), mat)
    kit.part(this.edgeArrow, "EdgeArrowShaft", "cylinder", new vec3(0, 0, -1.8), new vec3(1.1, 3.6, 1.1), new vec3(90, 0, 0), mat)
  }

  /** Shows the route arrow above `worldPos` (glides there if it was already visible). */
  pointAt(worldPos: vec3): void {
    const localPos = this.toLocal(worldPos)
    this.target = localPos
    if (this.moveTween) this.moveTween.cancel()
    if (!this.visible) {
      this.basePos = localPos
      this.visible = true
      this.routeArrow.enabled = true
      return
    }
    const from = this.basePos
    this.moveTween = this.tween.tween(0.45, (t) => {
      const e = Ease.inOutSine(t)
      const p = vec3.lerp(from, localPos, e)
      this.basePos = p.add(new vec3(0, Math.sin(Math.PI * t) * 12, 0))
    }, () => (this.basePos = localPos))
  }

  hide(): void {
    this.visible = false
    this._edgeVisible = false
    if (this.moveTween) this.moveTween.cancel()
    this.routeArrow.enabled = false
    this.edgeArrow.enabled = false
  }

  private toLocal(worldPos: vec3): vec3 {
    return this.sceneObject.getTransform().getInvertedWorldTransform().multiplyPoint(worldPos)
  }

  private toWorld(localPos: vec3): vec3 {
    return this.sceneObject.getTransform().getWorldTransform().multiplyPoint(localPos)
  }

  private onUpdate(): void {
    if (!this.visible) return
    this.phase += getDeltaTime() * Math.PI * 2 * 0.9
    const bob = Math.sin(this.phase) * this.bobAmountCm
    this.routeArrow.getTransform().setLocalPosition(this.basePos.add(new vec3(0, bob, 0)))
    const targetWorld = this.toWorld(this.target)

    // Edge hint: only when the current spot is outside the view cone.
    let showEdge = false
    if (this.camera && this.edgeArrowAnchor) {
      const ct = this.camera.getTransform()
      const camPos = ct.getWorldPosition()
      const look = ct.back
      const toTarget = targetWorld.sub(camPos).normalize()
      const angle = Math.acos(Math.max(-1, Math.min(1, look.dot(toTarget)))) * (180 / Math.PI)
      showEdge = angle > this.viewHalfAngleDeg
      if (showEdge) {
        const anchorPos = this.edgeArrowAnchor.getTransform().getWorldPosition()
        const d = targetWorld.sub(anchorPos)
        const flat = new vec3(d.x, 0, d.z)
        if (flat.length > 0.001) {
          const dir = flat.normalize()
          const et = this.edgeArrow.getTransform()
          et.setWorldPosition(anchorPos.add(dir.uniformScale(9 + Math.sin(this.phase * 1.5) * 1.5)))
          et.setWorldRotation(quat.lookAt(dir, vec3.up()))
        } else {
          showEdge = false
        }
      }
    }
    this._edgeVisible = showEdge
    if (this.edgeArrow.enabled !== showEdge) this.edgeArrow.enabled = showEdge
  }
}
