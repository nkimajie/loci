/**
 * LociAnswerUI — the ✓ "Got it" / ✗ "Missed" self-check targets shown just below a
 * revealed object during the quiz. Two free-standing round buttons (no panel).
 *
 * Owns: buttons "GotItButton" and "MissedButton" (UIKit), their labels, layout,
 *       and moving itself to the anchor it is shown at.
 * API (Channel A): showAt(anchor), hide(); getter isVisible.
 *       Emits onGotIt / onMissed.
 * Must not: score answers or advance the quiz — LociMain does.
 */

import {FlexLayout} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexLayout"
import {FlexItem} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexItem"
import {FlexAlign, FlexDirection, FlexJustify} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexTypes"
import {Button} from "SpectaclesUIKit.lspkg/Scripts/Components/Button/Button"
import {ElementContent} from "SpectaclesUIKit.lspkg/Scripts/Components/Content/ElementContent"
import Event, {PublicApi} from "SpectaclesInteractionKit.lspkg/Utils/Event"

const ICON_CHECK: Texture = requireAsset("../Icons/check.png") as Texture
const ICON_CLOSE: Texture = requireAsset("../Icons/close.png") as Texture

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

const VIEW_DISTANCE_CM = 130 // eye → answer targets (chair / table / shelf are ~1.0–1.5 m from the eyes)
const LAYOUT_Z_LIFT = 0.02
const LABEL_H = 3.2
const LABEL_PAD_X = 0.9 // backing pill padding around the label text
const LABEL_PAD_Y = 0.35
const LABEL_CORNER = 1.0

@component
export class LociAnswerUI extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">LociAnswerUI – ✓ Got it / ✗ Missed self-check targets</span>')
  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Settings</span>')
  @ui.group_start("Settings")
  @input
  @hint("Diameter of each target in cm (brief: about 10 cm)")
  @widget(new SliderWidget(6, 14, 0.5))
  buttonSizeCm: number = 10

  @input
  @hint("Centre-to-centre distance between the two targets in cm (brief: 14 cm)")
  @widget(new SliderWidget(10, 24, 0.5))
  spacingCm: number = 14

  @input
  @hint("Label under the check target")
  gotItLabel: string = "Got it"

  @input
  @hint("Label under the cross target")
  missedLabel: string = "Missed"

  @input("vec4", "{1, 1, 1, 1}")
  @hint("Label text colour (keep it light: the Specs display is additive)")
  @widget(new ColorWidget())
  labelTextColor: vec4 = new vec4(1, 1, 1, 1)

  @input("vec4", "{0.10, 0.68, 0.34, 0.96}")
  @hint("Backing pill behind the 'Got it' label: bright and saturated so white text reads on any surface")
  @widget(new ColorWidget())
  gotItBackingColor: vec4 = new vec4(0.1, 0.68, 0.34, 0.96)

  @input("vec4", "{0.92, 0.24, 0.30, 0.96}")
  @hint("Backing pill behind the 'Missed' label: bright and saturated so white text reads on any surface")
  @widget(new ColorWidget())
  missedBackingColor: vec4 = new vec4(0.92, 0.24, 0.3, 0.96)
  @ui.group_end

  private host!: SceneObject
  private _onGotIt = new Event<void>()
  private _onMissed = new Event<void>()
  private wantVisible = false
  private ready = false
  private appear = 0

  get onGotIt(): PublicApi<void> {
    return this._onGotIt.publicApi()
  }

  get onMissed(): PublicApi<void> {
    return this._onMissed.publicApi()
  }

  get isVisible(): boolean {
    return this.wantVisible
  }

  onAwake(): void {
    this.sceneObject.createComponent("Component.Canvas")
    this.host = this.obj(this.sceneObject, "AnswerTargets")

    const gap = Math.max(0.5, this.spacingCm - this.buttonSizeCm)
    const colW = this.buttonSizeCm
    const colH = this.buttonSizeCm + 0.6 + LABEL_H
    const row = this.flexRow(this.host, colW * 2 + gap, colH, {gap, justify: FlexJustify.Center, align: FlexAlign.Start})

    this.flexChild(row, {w: colW, h: colH}, (cell) => {
      this.addTarget(cell, "GotItButton", ICON_CHECK, "Primary", this.gotItLabel, this.gotItBackingColor, colW, colH, () => {
        if (this.wantVisible) this._onGotIt.invoke()
      })
    })
    this.flexChild(row, {w: colW, h: colH}, (cell) => {
      this.addTarget(cell, "MissedButton", ICON_CLOSE, "PrimaryNeutral", this.missedLabel, this.missedBackingColor, colW, colH, () => {
        if (this.wantVisible) this._onMissed.invoke()
      })
    })

    this.host.getTransform().setLocalScale(vec3.one().uniformScale(0.001))
    this.createEvent("UpdateEvent").bind(() => this.onUpdate())
  }

  /** Moves the targets to `anchor` (position + facing) and pops them in. */
  showAt(anchor: SceneObject): void {
    const at = anchor.getTransform()
    const t = this.sceneObject.getTransform()
    t.setWorldPosition(at.getWorldPosition())
    t.setWorldRotation(at.getWorldRotation())
    this.wantVisible = true
    if (this.ready) this.host.enabled = true
  }

  hide(): void {
    this.wantVisible = false
  }

  private addTarget(
    cell: SceneObject,
    name: string,
    icon: Texture,
    style: string,
    label: string,
    backing: vec4,
    w: number,
    h: number,
    onPress: () => void,
  ): void {
    const col = this.flexColumn(cell, w, h, {gap: 0.6, justify: FlexJustify.Start, align: FlexAlign.Center})
    this.flexChild(col, {w: this.buttonSizeCm, h: this.buttonSizeCm}, (slot) => {
      const so = this.obj(slot, name)
      const btn = so.createComponent(Button.getTypeName()) as Button
      btn.setVariant({theme: "SnapOS2", shape: "Round", style})
      btn.size = new vec3(this.buttonSizeCm, this.buttonSizeCm, 1)
      const ec = so.createComponent(ElementContent.getTypeName()) as ElementContent
      ec.leadingIcon = icon
      ec.leadingIconSize = this.buttonSizeCm * 0.55
      btn.onTriggerUp.add(onPress)
    })
    this.flexChild(col, {w: w + 2, h: LABEL_H}, (slot) => {
      const t = slot.createComponent("Component.Text") as Text
      t.text = label
      t.depthTest = true
      applyTextRole(t, "Headline2", VIEW_DISTANCE_CM)
      t.textFill.color = this.labelTextColor
      // Solid pill behind the label so it reads against the chair / table / shelf.
      const bg = t.backgroundSettings
      bg.enabled = true
      bg.fill.color = backing
      bg.margins = Rect.create(LABEL_PAD_X, LABEL_PAD_X, LABEL_PAD_Y, LABEL_PAD_Y)
      bg.cornerRadius = LABEL_CORNER
      t.horizontalAlignment = HorizontalAlignment.Center
      t.verticalAlignment = VerticalAlignment.Center
      t.horizontalOverflow = HorizontalOverflow.Overflow
      t.verticalOverflow = VerticalOverflow.Overflow
      t.layoutRect = Rect.create(-(w + 2) / 2, (w + 2) / 2, -LABEL_H / 2, LABEL_H / 2)
    })
  }

  private onUpdate(): void {
    if (!this.ready) {
      this.ready = true
      this.host.enabled = this.wantVisible
    }
    const target = this.wantVisible ? 1 : 0
    const step = getDeltaTime() * 6
    this.appear = this.appear < target ? Math.min(target, this.appear + step) : Math.max(target, this.appear - step)
    if (this.appear <= 0 && !this.wantVisible) {
      if (this.host.enabled) this.host.enabled = false
      return
    }
    if (!this.host.enabled) this.host.enabled = true
    this.host.getTransform().setLocalScale(vec3.one().uniformScale(Math.max(0.001, this.appear)))
  }

  // ── Layout composition helpers (verbatim from /specs-build-ui helpers.md) ──
  private obj(parent: SceneObject, name: string, position?: vec3): SceneObject {
    const sceneObject = global.scene.createSceneObject(name)
    sceneObject.setParent(parent)
    if (position) sceneObject.getTransform().setLocalPosition(position)
    return sceneObject
  }

  private liftInZ(sceneObject: SceneObject, zOffset: number): void {
    const transform = sceneObject.getTransform()
    const pos = transform.getLocalPosition()
    transform.setLocalPosition(new vec3(pos.x, pos.y, pos.z + zOffset))
  }

  private flexColumn(parent: SceneObject, width: number, height: number,
      opts?: {gap?: number, padY?: number, padX?: number, justify?: FlexJustify, align?: FlexAlign}): SceneObject {
    return this.makeFlex(parent, FlexDirection.Column, width, height, opts)
  }

  private flexRow(parent: SceneObject, width: number, height: number,
      opts?: {gap?: number, padY?: number, padX?: number, justify?: FlexJustify, align?: FlexAlign}): SceneObject {
    return this.makeFlex(parent, FlexDirection.Row, width, height, opts)
  }

  private makeFlex(parent: SceneObject, direction: FlexDirection, width: number, height: number,
      opts?: {gap?: number, padY?: number, padX?: number, justify?: FlexJustify, align?: FlexAlign}): SceneObject {
    const container = this.obj(parent, "Flex")
    this.liftInZ(container, LAYOUT_Z_LIFT)
    const flexLayout = container.createComponent(FlexLayout.getTypeName()) as FlexLayout
    // Children are registered explicitly via addItems (this UIKit throws on pre-init addItems otherwise).
    flexLayout.autoDiscoverItemsOnStart = false
    const flexItem = container.createComponent(FlexItem.getTypeName()) as FlexItem
    if (width > 0) flexItem.overrideWidth = width
    if (height > 0) flexItem.overrideHeight = height
    flexLayout.onInitialized.add(() => {
      flexLayout.width = width
      flexLayout.height = height
      flexLayout.direction = direction
      if (direction === FlexDirection.Row) {
        flexLayout.columnGap = opts?.gap ?? 0
      } else {
        flexLayout.rowGap = opts?.gap ?? 0
      }
      flexLayout.paddingTop = opts?.padY ?? 0
      flexLayout.paddingBottom = opts?.padY ?? 0
      flexLayout.paddingLeft = opts?.padX ?? 0
      flexLayout.paddingRight = opts?.padX ?? 0
      flexLayout.justifyContent = opts?.justify ?? FlexJustify.Start
      flexLayout.alignItems = opts?.align ?? FlexAlign.Stretch
    })
    return container
  }

  private flexChild(parent: SceneObject, size: {w?: number, h?: number, grow?: number},
      builder: (childObject: SceneObject) => void): SceneObject {
    const child = this.obj(parent, "Item")
    this.liftInZ(child, LAYOUT_Z_LIFT)
    const flexItem = child.createComponent(FlexItem.getTypeName()) as FlexItem
    if (size.w !== undefined && size.w > 0) flexItem.overrideWidth = size.w
    if (size.h !== undefined && size.h > 0) flexItem.overrideHeight = size.h
    flexItem.flexGrow = size.grow ?? 0
    flexItem.flexShrink = 0
    builder(child)
    const parentFlexLayout = parent.getComponent(FlexLayout.getTypeName()) as FlexLayout | null
    if (parentFlexLayout) parentFlexLayout.addItems([flexItem])
    return child
  }
}
