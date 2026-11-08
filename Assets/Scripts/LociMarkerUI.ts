/**
 * LociMarkerUI — one neutral "?" marker disc floating just above a route spot (quiz).
 *
 * Owns: a UIKit round Button (named "<SceneObjectName>Button", e.g. "Spot3_MarkerButton")
 *       with a question-mark icon in a bright neutral skin, its pop-in / pop-out,
 *       pulse, and the red "wrong spot" shake.
 * API (Channel A): popIn(), popOut(), setPulsing(on), shakeWrong(sec); getters
 *       isVisible / isPulsing / isShaking. Emits onPinched when the visible marker is pinched.
 * Must not: decide quiz order or reveal items — LociMain / LociSpot do that.
 */

import {Button} from "SpectaclesUIKit.lspkg/Scripts/Components/Button/Button"
import {ElementContent} from "SpectaclesUIKit.lspkg/Scripts/Components/Content/ElementContent"
import Event, {PublicApi} from "SpectaclesInteractionKit.lspkg/Utils/Event"
import {applyFill, paintButton, whiteContent} from "./LociButtonSkin"

const ICON_QUESTION: Texture = requireAsset("../Icons/question_mark.png") as Texture

function outBack(t: number): number {
  const c1 = 1.70158
  const c3 = c1 + 1
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2)
}

@component
export class LociMarkerUI extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">LociMarkerUI – the "?" disc a route object shrinks into during the quiz</span>')
  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Settings</span>')
  @ui.group_start("Settings")
  @input
  @hint("Diameter of the ? disc in cm (brief: about 8 cm)")
  @widget(new SliderWidget(4, 14, 0.5))
  markerSizeCm: number = 8

  @input
  @hint("How much the current marker grows while pulsing (fraction of its size)")
  @widget(new SliderWidget(0, 0.4, 0.01))
  pulseAmount: number = 0.18

  @input
  @hint("Pulses per second for the current marker")
  @widget(new SliderWidget(0.3, 3, 0.1))
  pulseRate: number = 1.2

  @input("vec4", "{0.60, 0.70, 0.98, 1}")
  @hint("Marker fill: bright and neutral (every spot looks the same, so it gives nothing away)")
  @widget(new ColorWidget())
  neutralColor: vec4 = new vec4(0.6, 0.7, 0.98, 1)

  @input("vec4", "{0.96, 0.22, 0.26, 1}")
  @hint("Marker fill while it shakes after a wrong pinch")
  @widget(new ColorWidget())
  wrongColor: vec4 = new vec4(0.96, 0.22, 0.26, 1)
  @ui.group_end

  private buttonObj!: SceneObject
  private _onPinched = new Event<void>()
  private wantVisible = false
  private ready = false
  private appear = 0
  private pulsing = false
  private phase = 0
  private btn!: Button
  private shakeLeft = 0
  private shakeTotal = 0

  get onPinched(): PublicApi<void> {
    return this._onPinched.publicApi()
  }

  get isVisible(): boolean {
    return this.wantVisible
  }

  get isPulsing(): boolean {
    return this.wantVisible && this.pulsing
  }

  /** True while the red "wrong spot" shake is playing. */
  get isShaking(): boolean {
    return this.shakeLeft > 0
  }

  /** SceneObject that carries the SIK Interactable (pinch target for tests). */
  get buttonSceneObject(): SceneObject {
    return this.buttonObj
  }

  onAwake(): void {
    this.sceneObject.createComponent("Component.Canvas")
    this.buttonObj = global.scene.createSceneObject(this.sceneObject.name + "Button")
    this.buttonObj.setParent(this.sceneObject)

    const btn = this.buttonObj.createComponent(Button.getTypeName()) as Button
    this.btn = btn
    btn.setVariant({theme: "SnapOS2", shape: "Round", style: "Primary"})
    btn.size = new vec3(this.markerSizeCm, this.markerSizeCm, 1)
    const ec = this.buttonObj.createComponent(ElementContent.getTypeName()) as ElementContent
    ec.leadingIcon = ICON_QUESTION
    ec.leadingIconSize = this.markerSizeCm * 0.6
    whiteContent(ec)
    paintButton(this, btn, this.neutralColor)
    btn.onTriggerUp.add(() => {
      if (this.wantVisible) this._onPinched.invoke()
    })

    // Start hidden without disabling before OnStart (UIKit init runs on OnStart).
    this.buttonObj.getTransform().setLocalScale(vec3.one().uniformScale(0.001))
    this.createEvent("UpdateEvent").bind(() => this.onUpdate())
  }

  popIn(): void {
    this.wantVisible = true
    if (this.ready) this.buttonObj.enabled = true
  }

  popOut(): void {
    this.wantVisible = false
    this.pulsing = false
  }

  setPulsing(on: boolean): void {
    this.pulsing = on
    if (on) this.phase = 0
  }

  /** Wrong-spot feedback: the disc turns red and shakes side to side, then turns neutral again. */
  shakeWrong(sec: number): void {
    this.shakeTotal = Math.max(0.05, sec)
    this.shakeLeft = this.shakeTotal
    applyFill(this.btn, this.wrongColor)
  }

  private onUpdate(): void {
    const dt = getDeltaTime()
    if (!this.ready) {
      this.ready = true
      this.buttonObj.enabled = this.wantVisible
    }
    const target = this.wantVisible ? 1 : 0
    const step = dt * 5
    this.appear = this.appear < target ? Math.min(target, this.appear + step) : Math.max(target, this.appear - step)
    if (this.appear <= 0 && !this.wantVisible) {
      if (this.buttonObj.enabled) this.buttonObj.enabled = false
      return
    }
    if (!this.buttonObj.enabled) this.buttonObj.enabled = true
    let s = this.wantVisible ? outBack(this.appear) : this.appear
    if (this.pulsing && this.wantVisible) {
      this.phase += dt * this.pulseRate * Math.PI * 2
      s *= 1 + this.pulseAmount * (0.5 + 0.5 * Math.sin(this.phase))
    }
    let x = 0
    if (this.shakeLeft > 0) {
      this.shakeLeft = Math.max(0, this.shakeLeft - dt)
      const k = this.shakeLeft / this.shakeTotal
      x = Math.sin((1 - k) * Math.PI * 2 * 5) * this.markerSizeCm * 0.28 * k
      s *= 1 + 0.12 * k
      if (this.shakeLeft <= 0) applyFill(this.btn, this.neutralColor)
    }
    const t = this.buttonObj.getTransform()
    t.setLocalPosition(new vec3(x, 0, 0))
    t.setLocalScale(vec3.one().uniformScale(Math.max(0.001, s)))
  }
}
