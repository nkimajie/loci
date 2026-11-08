/**
 * LociCardUI — the small light "Loci" card ~20 cm above the table's front edge
 * (in the Lens Studio preview LociMain moves it to ~0.9 m in front of the viewer).
 * One spot, five views:
 *   start     — "Loci", Say my list / Sample list / Mixed list, status line
 *   switch    — Walk again / Quiz me
 *   prompt    — Find-it quiz: small 3D icon of the item, "Where's the <item>?", "2 of 5"
 *   results   — "4 / 5" score + Review missed / Quiz again / New list (fades after ~10 s)
 *   collapsed — small "4 / 5 · Options" pill left after the results card fades
 *
 * Owns: every card button + label (UIKit BackPlate / FlexLayout / Button), view
 *       switching, the prompt icon slot and the results fade timer (view state only).
 * API (Channel A): showStart(), showSwitch(), showPrompt(question, hint, progress),
 *       showResults(score, hint), hideAll(), setStatus(msg), clearPromptIcon();
 *       getters visibleView / scoreText / statusText / promptText / promptProgress /
 *       promptIconHost.
 *       Emits onSayList, onSampleList, onMixedList, onWalkAgain, onQuizMe,
 *       onReviewMissed, onQuizAgain, onNewList.
 * Must not: parse lists, score, or decide the flow — LociMain does.
 */

import {FlexLayout} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexLayout"
import {FlexItem} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexItem"
import {FlexAlign, FlexAlignSelf, FlexDirection, FlexJustify} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexTypes"
import {BackPlate} from "SpectaclesUIKit.lspkg/Scripts/BackPlate"
import {Button} from "SpectaclesUIKit.lspkg/Scripts/Components/Button/Button"
import {ElementContent} from "SpectaclesUIKit.lspkg/Scripts/Components/Content/ElementContent"
import {RoundedRectangle} from "SpectaclesUIKit.lspkg/Scripts/Visuals/RoundedRectangle/RoundedRectangle"
import Event, {PublicApi} from "SpectaclesInteractionKit.lspkg/Utils/Event"
import {paintButton, whiteContent} from "./LociButtonSkin"

const ICON_MIC: Texture = requireAsset("../Icons/mic.png") as Texture
const ICON_SAMPLE: Texture = requireAsset("../Icons/format_list_numbered.png") as Texture
const ICON_MIXED: Texture = requireAsset("../Icons/shuffle.png") as Texture
const ICON_WALK: Texture = requireAsset("../Icons/directions_walk.png") as Texture
const ICON_QUIZ: Texture = requireAsset("../Icons/quiz.png") as Texture
const ICON_REVIEW: Texture = requireAsset("../Icons/visibility.png") as Texture
const ICON_REPLAY: Texture = requireAsset("../Icons/replay.png") as Texture
const ICON_NEW: Texture = requireAsset("../Icons/add.png") as Texture

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

// On Specs the card sits ~20 cm above the table's front edge (~0.85 m from the eyes);
// in the preview it floats 0.9 m in front of the camera. Text is sized for 0.9 m.
const VIEW_DISTANCE_CM = 90
const PAD = 1.4
// Captions (subtitle, status, hints) are scaled up so they read in a 1080p screen recording.
const CAPTION_SCALE = 1.35
// Find-it prompt: square slot for the item's small 3D icon.
const ICON_SLOT_CM = 6.5

// Card buttons: solid bright fills (LociButtonSkin), white bold labels 1.5x the
// type-scale Button size, on a taller capsule so the bigger label has room.
const BUTTON_H = 4.2
const BUTTON_TEXT_SCALE = 1.5
const BUTTON_TEXT_WEIGHT = 700
const BUTTON_ICON = 2.1

type ButtonTone = "primary" | "secondary"

export type CardView = "none" | "start" | "switch" | "prompt" | "results" | "collapsed"

interface ViewRec {
  root: SceneObject
  appear: number
}

@component
export class LociCardUI extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">LociCardUI – start / switch / results card above the table front</span>')
  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Settings</span>')
  @ui.group_start("Settings")
  @input
  @hint("Card width in cm")
  @widget(new SliderWidget(12, 26, 0.5))
  panelWidthCm: number = 19

  @input("vec4", "{0.97, 0.96, 0.92, 0.96}")
  @hint("Card background: light and bright (the Specs display is additive, so dark colours vanish)")
  @widget(new ColorWidget())
  cardTint: vec4 = new vec4(0.97, 0.96, 0.92, 0.96)

  @input("vec4", "{0.11, 0.15, 0.42, 1}")
  @hint("Title / score text on the light card: deep ink so it stands out from the bright card")
  @widget(new ColorWidget())
  cardTextColor: vec4 = new vec4(0.11, 0.15, 0.42, 1)

  @input("vec4", "{0.27, 0.31, 0.52, 1}")
  @hint("Subtitle / status / hint text on the light card")
  @widget(new ColorWidget())
  cardSubtleTextColor: vec4 = new vec4(0.27, 0.31, 0.52, 1)

  @input("vec4", "{0.05, 0.50, 1.0, 1}")
  @hint("Fill for each card's main button (Sample list, Quiz me, Review missed): bright and saturated")
  @widget(new ColorWidget())
  primaryButtonColor: vec4 = new vec4(0.05, 0.5, 1.0, 1)

  @input("vec4", "{0.58, 0.28, 0.98, 1}")
  @hint("Fill for the other card buttons: bright and saturated")
  @widget(new ColorWidget())
  secondaryButtonColor: vec4 = new vec4(0.58, 0.28, 0.98, 1)

  @input
  @hint("Title on the start card")
  titleText: string = "Loci"

  @input
  @hint("One-line subtitle under the title")
  subtitleText: string = "Turn your list into a route"

  @input
  @hint("Seconds before the results card fades to a small Options pill (0 = never)")
  @widget(new SliderWidget(0, 30, 1))
  resultsFadeSec: number = 10
  @ui.group_end

  private views: {[k: string]: ViewRec} = {}
  private current: CardView = "start"
  private ready = false
  private fadeLeft = -1
  private statusLabel!: Text
  private scoreLabel!: Text
  private resultsHint!: Text
  private optionsLabel!: ElementContent
  private promptLabel!: Text
  private promptHintLabel!: Text
  private promptProgressLabel!: Text
  private iconHost!: SceneObject
  private iconSpin = 0
  private _score = ""
  private _status = ""
  private _prompt = ""
  private _progress = ""

  private _onSayList = new Event<void>()
  private _onSampleList = new Event<void>()
  private _onMixedList = new Event<void>()
  private _onWalkAgain = new Event<void>()
  private _onQuizMe = new Event<void>()
  private _onReviewMissed = new Event<void>()
  private _onQuizAgain = new Event<void>()
  private _onNewList = new Event<void>()

  get onSayList(): PublicApi<void> { return this._onSayList.publicApi() }
  get onSampleList(): PublicApi<void> { return this._onSampleList.publicApi() }
  get onMixedList(): PublicApi<void> { return this._onMixedList.publicApi() }
  get onWalkAgain(): PublicApi<void> { return this._onWalkAgain.publicApi() }
  get onQuizMe(): PublicApi<void> { return this._onQuizMe.publicApi() }
  get onReviewMissed(): PublicApi<void> { return this._onReviewMissed.publicApi() }
  get onQuizAgain(): PublicApi<void> { return this._onQuizAgain.publicApi() }
  get onNewList(): PublicApi<void> { return this._onNewList.publicApi() }

  /** Which card view is showing ("none" when hidden). */
  get visibleView(): CardView {
    return this.current
  }

  get scoreText(): string {
    return this._score
  }

  get statusText(): string {
    return this._status
  }

  /** Find-it question while the prompt card shows ("" otherwise). */
  get promptText(): string {
    return this.current === "prompt" ? this._prompt : ""
  }

  get promptProgress(): string {
    return this.current === "prompt" ? this._progress : ""
  }

  /** Parent for the prompt's small 3D item icon (built by LociMain, centred and spun here). */
  get promptIconHost(): SceneObject {
    return this.iconHost
  }

  get promptIconSizeCm(): number {
    return ICON_SLOT_CM
  }

  onAwake(): void {
    this.sceneObject.createComponent("Component.Canvas")
    this.buildStart()
    this.buildSwitch()
    this.buildPrompt()
    this.buildResults()
    this.buildCollapsed()
    for (const k of Object.keys(this.views)) {
      if (k !== this.current) this.views[k].root.getTransform().setLocalScale(vec3.one().uniformScale(0.001))
      else this.views[k].appear = 1
    }
    this.createEvent("UpdateEvent").bind(() => this.onUpdate())
  }

  showStart(): void {
    this.setStatus("")
    this.show("start")
  }

  showSwitch(): void {
    this.show("switch")
  }

  /** Shows (or refreshes) the Find-it prompt. A refresh replays a quick pop so the change reads. */
  showPrompt(question: string, hint: string, progress: string): void {
    this._prompt = question
    this._progress = progress
    this.promptLabel.text = question
    this.promptHintLabel.text = hint
    this.promptProgressLabel.text = progress
    const rec = this.views["prompt"]
    if (this.current === "prompt" && rec) rec.appear = Math.min(rec.appear, 0.75)
    this.show("prompt")
  }

  /** Removes the previous prompt's icon model. */
  clearPromptIcon(): void {
    for (let i = this.iconHost.getChildrenCount() - 1; i >= 0; i--) this.iconHost.getChild(i).destroy()
    this.iconSpin = 0
  }

  showResults(score: string, hint: string): void {
    this._score = score
    this.scoreLabel.text = score
    this.resultsHint.text = hint
    this.optionsLabel.text = `${score}  ·  Options`
    this.show("results")
    this.fadeLeft = this.resultsFadeSec > 0 ? this.resultsFadeSec : -1
  }

  hideAll(): void {
    this.show("none")
  }

  setStatus(msg: string): void {
    this._status = msg
    if (this.statusLabel) this.statusLabel.text = msg
  }

  // ── Views ─────────────────────────────────────────────────────────────────

  private buildStart(): void {
    const {content} = this.panel("start", "StartCard")
    const inner = this.panelWidthCm - PAD * 2
    this.addText(content, "Title", this.titleText, "Title2", inner, 3.6)
    this.addText(content, "Subtitle", this.subtitleText, "Caption", inner, 2.4)
    this.addButton(content, "SayMyListButton", "Say my list", ICON_MIC, "secondary", inner, () => this._onSayList.invoke())
    this.addButton(content, "SampleListButton", "Sample list", ICON_SAMPLE, "primary", inner, () => this._onSampleList.invoke())
    this.addButton(content, "MixedListButton", "Mixed list", ICON_MIXED, "secondary", inner, () => this._onMixedList.invoke())
    this.statusLabel = this.addText(content, "StatusText", "", "Caption", inner, 3.0, true)
  }

  private buildSwitch(): void {
    const {content} = this.panel("switch", "SwitchCard")
    const inner = this.panelWidthCm - PAD * 2
    this.addText(content, "SwitchTitle", "Route ready", "Headline1", inner, 3.0)
    this.addText(content, "SwitchHint", "Walk it again, or test yourself", "Caption", inner, 2.4)
    this.addButton(content, "WalkAgainButton", "Walk again", ICON_WALK, "secondary", inner, () => this._onWalkAgain.invoke())
    this.addButton(content, "QuizMeButton", "Quiz me", ICON_QUIZ, "primary", inner, () => this._onQuizMe.invoke())
  }

  private buildPrompt(): void {
    const {content} = this.panel("prompt", "PromptCard")
    const inner = this.panelWidthCm - PAD * 2
    // Empty Text as the flex slot: Flex sizes Text via its layout rect (never by scale),
    // so the 3D icon parented under it keeps real-world centimetres.
    const slot = this.addText(content, "PromptIconSlot", "", "Caption", inner, ICON_SLOT_CM)
    this.iconHost = global.scene.createSceneObject("PromptIcon")
    this.iconHost.setParent(slot.getSceneObject())
    this.iconHost.getTransform().setLocalPosition(new vec3(0, 0, ICON_SLOT_CM * 0.45))
    this.promptLabel = this.addText(content, "PromptText", "Where's the …?", "Headline1", inner, 4.0)
    this.promptLabel.size *= 1.45 // the question is the one line that must read at a glance
    this.promptHintLabel = this.addText(content, "PromptHint", "Pinch the spot where it was", "Caption", inner, 2.4, true)
    this.promptProgressLabel = this.addText(content, "PromptProgress", "1 of 5", "Caption", inner, 2.2, true)
  }

  private buildResults(): void {
    const {content} = this.panel("results", "ResultsCard")
    const inner = this.panelWidthCm - PAD * 2
    this.scoreLabel = this.addText(content, "ScoreText", "5 / 5", "Title1", inner, 4.6)
    this.resultsHint = this.addText(content, "ResultsHint", "Missed spots are glowing", "Caption", inner, 2.8, true)
    this.addButton(content, "ReviewMissedButton", "Review missed", ICON_REVIEW, "primary", inner, () => this._onReviewMissed.invoke())
    this.addButton(content, "QuizAgainButton", "Quiz again", ICON_REPLAY, "secondary", inner, () => this._onQuizAgain.invoke())
    this.addButton(content, "NewListButton", "New list", ICON_NEW, "secondary", inner, () => this._onNewList.invoke())
  }

  private buildCollapsed(): void {
    const {content} = this.panel("collapsed", "ResultsCollapsed")
    const inner = this.panelWidthCm - PAD * 2
    this.optionsLabel = this.addButton(content, "ShowOptionsButton", "5 / 5  ·  Options", ICON_REPLAY, "secondary", inner, () => {
      this.show("results")
      this.fadeLeft = this.resultsFadeSec > 0 ? this.resultsFadeSec : -1
    })
  }

  // ── Building blocks ───────────────────────────────────────────────────────

  /** A view: BackPlate (light tint) + Content child at +0.6 z with a column FlexLayout. */
  private panel(key: CardView, name: string): {root: SceneObject; content: SceneObject} {
    const root = global.scene.createSceneObject(name)
    root.setParent(this.sceneObject)
    const backPlate = root.createComponent(BackPlate.getTypeName()) as BackPlate
    backPlate.style = "simple"
    backPlate.onInitialized.add(() => {
      const rr = root.getComponent(RoundedRectangle.getTypeName()) as RoundedRectangle
      if (rr) {
        rr.gradient = false
        rr.backgroundColor = this.cardTint
      }
    })

    const content = global.scene.createSceneObject("Content")
    content.setParent(root)
    content.getTransform().setLocalPosition(new vec3(0, 0, 0.6))
    const flex = content.createComponent(FlexLayout.getTypeName()) as FlexLayout
    flex.autoDiscoverItemsOnStart = false // items registered explicitly via addItems
    flex.width = this.panelWidthCm
    flex.height = -1
    flex.direction = FlexDirection.Column
    flex.justifyContent = FlexJustify.Start
    flex.alignItems = FlexAlign.Stretch
    flex.rowGap = 0.6
    flex.paddingTop = PAD
    flex.paddingBottom = PAD
    flex.paddingLeft = PAD
    flex.paddingRight = PAD
    flex.onLayoutComplete.add((r) => {
      backPlate.size = new vec2(r.containerWidth, r.containerHeight)
    })
    this.views[key] = {root, appear: 0}
    return {root, content}
  }

  /** Column-direction text row (full inner width, centred). */
  private addText(parent: SceneObject, name: string, text: string, role: TextRole, width: number, height: number, subtle: boolean = false): Text {
    const so = global.scene.createSceneObject(name)
    so.setParent(parent)
    so.getTransform().setLocalPosition(new vec3(0, 0, 0.15))
    const t = so.createComponent("Component.Text") as Text
    t.text = text
    t.depthTest = true
    applyTextRole(t, role, VIEW_DISTANCE_CM)
    if (role === "Caption") t.size *= CAPTION_SCALE
    t.textFill.color = subtle ? this.cardSubtleTextColor : this.cardTextColor
    t.horizontalAlignment = HorizontalAlignment.Center
    t.verticalAlignment = VerticalAlignment.Center
    t.horizontalOverflow = HorizontalOverflow.Wrap
    t.verticalOverflow = VerticalOverflow.Overflow
    t.layoutRect = Rect.create(-width / 2, width / 2, -height / 2, height / 2)
    const item = so.createComponent(FlexItem.getTypeName()) as FlexItem
    item.alignSelf = FlexAlignSelf.Stretch
    item.overrideHeight = height
    const flex = parent.getComponent(FlexLayout.getTypeName()) as FlexLayout | null
    if (flex) flex.addItems([item])
    return t
  }

  /** Full-width button whose whole face is one ElementContent (icon + label). */
  private addButton(parent: SceneObject, name: string, label: string, icon: Texture, tone: ButtonTone, width: number, onPress: () => void): ElementContent {
    const so = global.scene.createSceneObject(name)
    so.setParent(parent)
    const btn = so.createComponent(Button.getTypeName()) as Button
    btn.setVariant({theme: "SnapOS2", shape: "Capsule", style: "Primary"})
    btn.size = new vec3(width, BUTTON_H, 1)
    const ec = so.createComponent(ElementContent.getTypeName()) as ElementContent
    ec.text = label
    ec.textSize = roleSize("Button", VIEW_DISTANCE_CM) * BUTTON_TEXT_SCALE
    ec.leadingIcon = icon
    ec.leadingIconSize = BUTTON_ICON
    ec.spacing = 0.7
    whiteContent(ec)
    paintButton(this, btn, tone === "primary" ? this.primaryButtonColor : this.secondaryButtonColor, ec, BUTTON_TEXT_WEIGHT)
    btn.onTriggerUp.add(() => {
      if (this.isActiveButton(so)) onPress()
    })
    const item = so.createComponent(FlexItem.getTypeName()) as FlexItem
    item.overrideWidth = width
    item.overrideHeight = BUTTON_H
    const flex = parent.getComponent(FlexLayout.getTypeName()) as FlexLayout | null
    if (flex) flex.addItems([item])
    return ec
  }

  /** Ignore presses that land while a view is popping out. */
  private isActiveButton(so: SceneObject): boolean {
    const rec = this.views[this.current]
    return !!rec && so.isDescendantOf(rec.root)
  }

  private show(view: CardView): void {
    this.current = view
    this.fadeLeft = -1
    for (const k of Object.keys(this.views)) {
      const rec = this.views[k]
      if (k === view && this.ready) rec.root.enabled = true
    }
  }

  private onUpdate(): void {
    const dt = getDeltaTime()
    if (!this.ready) {
      this.ready = true
      for (const k of Object.keys(this.views)) this.views[k].root.enabled = k === this.current
    }
    if (this.current === "results" && this.fadeLeft > 0) {
      this.fadeLeft -= dt
      if (this.fadeLeft <= 0) this.show("collapsed")
    }
    if (this.current === "prompt" && this.iconHost) {
      // Gentle sway so the little 3D icon reads as an object, not a flat picture.
      this.iconSpin += dt
      const yaw = Math.sin(this.iconSpin * 1.3) * 0.45
      this.iconHost.getTransform().setLocalRotation(quat.angleAxis(yaw, vec3.up()))
    }
    for (const k of Object.keys(this.views)) {
      const rec = this.views[k]
      const target = k === this.current ? 1 : 0
      const step = dt * 6
      rec.appear = rec.appear < target ? Math.min(target, rec.appear + step) : Math.max(target, rec.appear - step)
      if (rec.appear <= 0 && target === 0) {
        if (rec.root.enabled) rec.root.enabled = false
        continue
      }
      if (!rec.root.enabled) rec.root.enabled = true
      rec.root.getTransform().setLocalScale(vec3.one().uniformScale(Math.max(0.001, rec.appear)))
    }
  }
}
