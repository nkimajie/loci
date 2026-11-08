/**
 * LociNameTagUI — the floating name label shown above an object for ~2 seconds
 * when it is studied, and while it is revealed in the quiz.
 *
 * Owns: a small BackPlate pill with one label, sized to its text; moving itself to
 *       the requested world pose; auto-hide after a hold time.
 * API (Channel A): showName(text, worldPos, worldRot, holdSec), hide();
 *       getters isVisible / currentText.
 * Must not: decide what is studied or when the walk advances — LociMain does.
 */

import {FlexLayout} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexLayout"
import {FlexItem} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexItem"
import {FlexAlign, FlexDirection, FlexJustify} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexTypes"
import {BackPlate} from "SpectaclesUIKit.lspkg/Scripts/BackPlate"

// ── Type scale (canonical block from /specs-build-ui patterns.md → Typography)
const FONT_SIZE_SCALE = 1.0
type TextRole =
  | "Title1" | "Title2" | "HeadlineXL" | "Headline1" | "Headline2"
  | "Subheadline" | "Button" | "Callout" | "Body" | "Caption"
const TYPE_SCALE: Record<TextRole, {size: number; weight: number}> = {
  Title1: {size: 105, weight: 700}, Title2: {size: 93, weight: 700},
  HeadlineXL: {size: 62, weight: 700}, Headline1: {size: 54, weight: 700},
  Headline2: {size: 48, weight: 700}, Subheadline: {size: 41, weight: 700},
  Button: {size: 39, weight: 500}, Callout: {size: 39, weight: 700},
  Body: {size: 39, weight: 500}, Caption: {size: 38, weight: 500},
}
function roleSize(role: TextRole, distanceCm: number = 110): number {
  return TYPE_SCALE[role].size * FONT_SIZE_SCALE * (distanceCm / 110)
}
function applyTextRole(t: Text, role: TextRole, distanceCm: number = 110): void {
  t.size = roleSize(role, distanceCm)
  ;(t as Text & {weight?: number}).weight = TYPE_SCALE[role].weight
}

const VIEW_DISTANCE_CM = 110 // eye → objects on the table / chair / shelf
const TEXT_H = 3.0
const PAD_X = 1.4
const PAD_Y = 0.9

@component
export class LociNameTagUI extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">LociNameTagUI – the item name shown above a studied / revealed object</span>')
  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Settings</span>')
  @ui.group_start("Settings")
  @input("vec4", "{1, 0.96, 0.82, 1}")
  @hint("Colour of the item name")
  @widget(new ColorWidget())
  textColor: vec4 = new vec4(1, 0.96, 0.82, 1)

  @input
  @hint("Approximate width per character in cm, used to size the pill to the name")
  @widget(new SliderWidget(0.4, 1.2, 0.02))
  charWidthCm: number = 0.72
  @ui.group_end

  private tag!: SceneObject
  private flex!: FlexLayout
  private textItem!: FlexItem
  private label!: Text
  private wantVisible = false
  private ready = false
  private appear = 0
  private holdLeft = -1
  private _text = ""
  private _viewScale = 1

  /**
   * Scales the tag up for a viewer farther away than the 1.1 m it is designed for (the
   * Lens Studio preview's stand-back camera); it rises by the extra height so it still
   * sits above the object. 1 = design size (always on Specs).
   */
  setViewScale(scale: number): void {
    this._viewScale = Math.max(1, scale)
    if (this.tag) this.tag.getTransform().setLocalPosition(new vec3(0, (TEXT_H / 2 + PAD_Y) * (this._viewScale - 1), 0))
  }

  get viewScale(): number {
    return this._viewScale
  }

  get isVisible(): boolean {
    return this.wantVisible
  }

  get currentText(): string {
    return this.wantVisible ? this._text : ""
  }

  onAwake(): void {
    this.sceneObject.createComponent("Component.Canvas")
    this.tag = global.scene.createSceneObject("NameTag")
    this.tag.setParent(this.sceneObject)
    const backPlate = this.tag.createComponent(BackPlate.getTypeName()) as BackPlate

    const content = global.scene.createSceneObject("Content")
    content.setParent(this.tag)
    content.getTransform().setLocalPosition(new vec3(0, 0, 0.6))
    this.flex = content.createComponent(FlexLayout.getTypeName()) as FlexLayout
    this.flex.autoDiscoverItemsOnStart = false // items registered explicitly via addItems
    this.flex.width = -1
    this.flex.height = -1
    this.flex.direction = FlexDirection.Column
    this.flex.justifyContent = FlexJustify.Center
    this.flex.alignItems = FlexAlign.Center
    this.flex.paddingTop = PAD_Y
    this.flex.paddingBottom = PAD_Y
    this.flex.paddingLeft = PAD_X
    this.flex.paddingRight = PAD_X
    this.flex.onLayoutComplete.add((r) => {
      backPlate.size = new vec2(r.containerWidth, r.containerHeight)
    })

    const textSO = global.scene.createSceneObject("NameText")
    textSO.setParent(content)
    textSO.getTransform().setLocalPosition(new vec3(0, 0, 0.15))
    this.label = textSO.createComponent("Component.Text") as Text
    this.label.text = "Umbrella"
    this.label.depthTest = true
    applyTextRole(this.label, "HeadlineXL", VIEW_DISTANCE_CM)
    this.label.textFill.color = this.textColor
    this.label.horizontalAlignment = HorizontalAlignment.Center
    this.label.verticalAlignment = VerticalAlignment.Center
    this.label.horizontalOverflow = HorizontalOverflow.Overflow
    this.label.verticalOverflow = VerticalOverflow.Overflow
    this.textItem = textSO.createComponent(FlexItem.getTypeName()) as FlexItem
    this.setWidthFor("Umbrella")
    this.flex.addItems([this.textItem])

    this.tag.getTransform().setLocalScale(vec3.one().uniformScale(0.001))
    this.createEvent("UpdateEvent").bind(() => this.onUpdate())
  }

  /** Shows `text` at a world pose. holdSec <= 0 keeps it up until hide(). */
  showName(text: string, worldPos: vec3, worldRot: quat, holdSec: number): void {
    this._text = text
    this.label.text = text
    this.setWidthFor(text)
    this.flex.markDirty()
    const t = this.sceneObject.getTransform()
    t.setWorldPosition(worldPos)
    t.setWorldRotation(worldRot)
    this.wantVisible = true
    this.holdLeft = holdSec > 0 ? holdSec : -1
    this.appear = 0
    if (this.ready) this.tag.enabled = true
  }

  hide(): void {
    this.wantVisible = false
    this.holdLeft = -1
  }

  private setWidthFor(text: string): void {
    const w = Math.max(6, Math.min(34, text.length * this.charWidthCm + 1.6))
    this.label.layoutRect = Rect.create(-w / 2, w / 2, -TEXT_H / 2, TEXT_H / 2)
    this.textItem.overrideWidth = w
    this.textItem.overrideHeight = TEXT_H
  }

  private onUpdate(): void {
    const dt = getDeltaTime()
    if (!this.ready) {
      this.ready = true
      this.tag.enabled = this.wantVisible
    }
    if (this.wantVisible && this.holdLeft > 0) {
      this.holdLeft -= dt
      if (this.holdLeft <= 0) this.hide()
    }
    const target = this.wantVisible ? 1 : 0
    const step = dt * 6
    this.appear = this.appear < target ? Math.min(target, this.appear + step) : Math.max(target, this.appear - step)
    if (this.appear <= 0 && !this.wantVisible) {
      if (this.tag.enabled) this.tag.enabled = false
      return
    }
    if (!this.tag.enabled) this.tag.enabled = true
    this.tag.getTransform().setLocalScale(vec3.one().uniformScale(Math.max(0.001, this.appear * this._viewScale)))
  }
}
