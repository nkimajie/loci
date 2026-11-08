/**
 * LociMain — orchestrates the Loci memory-palace session:
 *   start card → list (Sample / Mixed / voice) → objects drop onto 5 spots in route
 *   order → study walk (one spot pulses) → group glow → Walk again / Quiz me →
 *   "?" markers → reveal + ✓/✗ → results ("4 / 5", missed glow) → Review missed /
 *   Quiz again / New list.
 *
 * Owns: the flow and timing (LociState holds the data), wiring UI events to actions,
 *       aligning the authored palace to the user, and the test-facing state getters.
 * Expects @inputs: camera, palace root, shape kit, audio, voice, guide, the 4 UI
 *       modules and the 5 authored spots (all wired by the scene bootstrap).
 * Must not: author UI text/buttons (those live in the *UI.ts modules) or build
 *       geometry (LociSpot / LociModelBuilder / LociGuide do).
 *
 * Test / LEAF surface: phase, currentSpotIndex, pulsingSpots, placedModelIds,
 * totemTexts, placementOrder, scoreText, missedSpots, glowingSpots, walkQueue,
 * visitedSpots, markerVisibleSpots, revealedSpot, answerButtonsVisible,
 * cardView, getStateJson(); actions press*() / pinchItem(i) / pinchMarker(i).
 */

import {LociAnswerUI} from "./LociAnswerUI"
import {LociAudio} from "./LociAudio"
import {LociCardUI} from "./LociCardUI"
import {LociGuide} from "./LociGuide"
import {LociNameTagUI} from "./LociNameTagUI"
import {ListItem, parseAndMatch} from "./LociParser"
import {runLociSelfTest} from "./LociSelfTest"
import {LociShapeKit} from "./LociShapeKit"
import {LociSpot} from "./LociSpot"
import {LociState, Phase, SPOT_COUNT} from "./LociState"
import {LociVoice} from "./LociVoice"
import {Tweener} from "./LociTween"

// Timings dictated by the brief ("glow together for 2 seconds") or pure pacing.
const GROUP_GLOW_SEC = 2.0
const DROP_INTERVAL_SEC = 0.55
const SHRINK_INTERVAL_SEC = 0.3
const GAZE_CONE_DEG = 6

@component
export class LociMain extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">LociMain – memory-palace flow: build, study, quiz, results</span>')
  @ui.separator
  @ui.label('<span style="color: #60A5FA;">References</span>')
  @ui.group_start("References")
  @input
  @hint("The world camera (Camera Object) — the user's eyes")
  cameraObject!: SceneObject

  @input
  @hint("Room root: floor under the user's feet; stand-ins, spots and UI are children")
  palaceRoot!: SceneObject

  @input
  @hint("Shared simple-shape geometry kit")
  shapeKit!: LociShapeKit

  @input
  @hint("Sound cues")
  audio!: LociAudio

  @input
  @hint("Speech-to-text for 'Say my list'")
  voice!: LociVoice

  @input
  @hint("Route arrow + edge arrow")
  guide!: LociGuide

  @input
  @hint("Start / switch / results card")
  card!: LociCardUI

  @input
  @hint("✓ Got it / ✗ Missed targets")
  answers!: LociAnswerUI

  @input
  @hint("Item name label")
  nameTag!: LociNameTagUI

  @input
  @hint("Spot 1 — chair seat")
  spot1!: LociSpot

  @input
  @hint("Spot 2 — table left")
  spot2!: LociSpot

  @input
  @hint("Spot 3 — table back-centre (hero spot)")
  spot3!: LociSpot

  @input
  @hint("Spot 4 — table right")
  spot4!: LociSpot

  @input
  @hint("Spot 5 — shelf top")
  spot5!: LociSpot
  @ui.group_end

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Settings</span>')
  @ui.group_start("Settings")
  @input
  @hint("Text the 'Sample list' button sends through the list parser (route order)")
  sampleListText: string = "umbrella, keys, milk, call mom, gift"

  @input
  @hint("Text the 'Mixed list' button sends through the same parser + matcher as voice")
  mixedListText: string = "umbrella, keys, volcano, mobile, gift"

  @input
  @hint("User eye height in cm — places the virtual floor under the user at start")
  @widget(new SliderWidget(120, 200, 1))
  eyeHeightCm: number = 160

  @input
  @hint("Seconds an item's name shows after pinching it in study mode")
  @widget(new SliderWidget(0.5, 5, 0.1))
  nameShowSec: number = 2

  @input
  @hint("Seconds of looking at the current object that count as a pinch (0 = off)")
  @widget(new SliderWidget(0, 5, 0.1))
  gazeDwellSec: number = 2
  @ui.group_end

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Lens Studio preview only (ignored on Specs)</span>')
  @ui.group_start("Preview")
  @input
  @hint("Preview camera starts this far behind the user's spot (the user's spot is 0.5 m from the table front). The Specs view is only ~32° wide, so from the user's spot the chair and shelf are out of frame; 360 puts the start card, all 5 spots and their ✓/✗ targets in one frame for recording. 0 = start at the user's spot. While > 0, gaze dwell is off in the preview (the camera is a recording view, not the user's eyes).")
  @widget(new SliderWidget(0, 400, 10))
  previewStandBackCm: number = 360
  @ui.group_end

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Debug</span>')
  @ui.group_start("Debug")
  @input
  @hint("Move the room so the floor is under the user's starting head pose")
  alignToUserOnStart: boolean = true

  @input
  @hint("Draw every pinch collider as a wireframe (takes effect on preview restart)")
  debugColliders: boolean = false

  @input
  @hint("Runs the scripted self-test of the 5 done criteria and prints PASS/FAIL")
  runSelfTest: boolean = false

  @input
  @hint("Print phase changes to the log")
  logStateChanges: boolean = true
  @ui.group_end

  private state = new LociState()
  private spots: LociSpot[] = []
  private tween!: Tweener
  private flow = 0
  private eyeWorld: vec3 = vec3.zero()
  private dwell = 0
  private _placementOrder: number[] = []
  private _placementTimes: number[] = []
  private _lastListSource = ""
  private started = false
  private standBackCm = 0

  onAwake(): void {
    this.tween = new Tweener(this)
    this.spots = [this.spot1, this.spot2, this.spot3, this.spot4, this.spot5]
    const missing: string[] = []
    const refs: {[k: string]: any} = {
      cameraObject: this.cameraObject, palaceRoot: this.palaceRoot, shapeKit: this.shapeKit, audio: this.audio,
      voice: this.voice, guide: this.guide, card: this.card, answers: this.answers, nameTag: this.nameTag,
      spot1: this.spot1, spot2: this.spot2, spot3: this.spot3, spot4: this.spot4, spot5: this.spot5,
    }
    for (const k of Object.keys(refs)) if (!refs[k]) missing.push(k)
    if (missing.length > 0) {
      print("LociMain: required @input not wired: " + missing.join(", "))
      return
    }
    this.createEvent("OnStartEvent").bind(() => this.start())
    this.createEvent("UpdateEvent").bind(() => this.onUpdate())
  }

  private start(): void {
    this.standBackCm = this.alignToUserOnStart && global.deviceInfoSystem.isEditor() ? Math.max(0, this.previewStandBackCm) : 0
    if (this.alignToUserOnStart) this.alignPalace()
    this.eyeWorld = this.cameraObject.getTransform().getWorldPosition()
    this.log(`camera start ${this.eyeWorld.toString()}, room floor at ${this.palaceRoot.getTransform().getWorldPosition().toString()}` +
      (this.standBackCm > 0 ? `, preview camera ${this.standBackCm} cm behind the user's spot (gaze dwell off)` : ""))
    this.audio.setup(this.cameraObject)
    this.guide.setup(this.shapeKit, this.cameraObject)
    for (const s of this.spots) {
      s.setup(this.shapeKit, this.audio, this.eyeWorld)
      s.onItemPinched.add((i) => this.pinchItem(i))
      s.onMarkerPinched.add((i) => this.pinchMarker(i))
    }
    this.card.onSayList.add(() => this.pressSayList())
    this.card.onSampleList.add(() => this.pressSampleList())
    this.card.onMixedList.add(() => this.pressMixedList())
    this.card.onWalkAgain.add(() => this.pressWalkAgain())
    this.card.onQuizMe.add(() => this.pressQuizMe())
    this.card.onReviewMissed.add(() => this.pressReviewMissed())
    this.card.onQuizAgain.add(() => this.pressQuizAgain())
    this.card.onNewList.add(() => this.pressNewList())
    this.answers.onGotIt.add(() => this.pressGotIt())
    this.answers.onMissed.add(() => this.pressMissed())
    this.voice.onPartial.add((t) => this.onVoicePartial(t))
    this.voice.onFinal.add((t) => this.onVoiceFinal(t))
    this.voice.onError.add((m) => this.onVoiceError(m))
    if (this.debugColliders) this.setColliderDebugAll(this.palaceRoot, true)
    this.started = true
    this.setPhase("start")
    this.card.showStart()
    if (this.runSelfTest) {
      this.gazeDwellSec = 0
      runLociSelfTest(this, this.tween)
    }
  }

  /**
   * Puts the authored room's floor under the user's start pose, facing where they look.
   * In the Lens Studio preview the room also moves `standBackCm` ahead along the look
   * direction, so the camera starts that far behind the user's spot.
   */
  private alignPalace(): void {
    const cam = this.cameraObject.getTransform()
    const p = cam.getWorldPosition()
    const look = cam.back
    const yaw = Math.atan2(-look.x, -look.z)
    const ahead = new vec3(-Math.sin(yaw), 0, -Math.cos(yaw)).uniformScale(this.standBackCm)
    const pt = this.palaceRoot.getTransform()
    pt.setWorldPosition(new vec3(p.x, p.y - this.eyeHeightCm, p.z).add(ahead))
    pt.setWorldRotation(quat.angleAxis(yaw, vec3.up()))
  }

  // ── Actions (UI events and tests both call these) ─────────────────────────

  pressSampleList(): boolean {
    return this.beginList(this.sampleListText, "sample")
  }

  pressMixedList(): boolean {
    return this.beginList(this.mixedListText, "mixed")
  }

  pressSayList(): boolean {
    if (this.state.phase !== "start") return false
    this.setPhase("listening")
    this.card.setStatus("Listening… say 5 things, like “umbrella, keys, milk, phone, gift”")
    this.voice.startListening()
    return true
  }

  pressWalkAgain(): boolean {
    if (this.state.phase !== "switch") return false
    this.card.hideAll()
    this.startWalk([0, 1, 2, 3, 4], false)
    return true
  }

  pressQuizMe(): boolean {
    if (this.state.phase !== "switch") return false
    this.card.hideAll()
    this.startQuiz()
    return true
  }

  pressReviewMissed(): boolean {
    if (this.state.phase !== "results") return false
    const missed = this.state.missed
    this.card.hideAll()
    this.allGlow("off")
    this.startWalk(missed.length > 0 ? missed : [0, 1, 2, 3, 4], true)
    return true
  }

  pressQuizAgain(): boolean {
    if (this.state.phase !== "results") return false
    this.card.hideAll()
    this.allGlow("off")
    this.startQuiz()
    return true
  }

  pressNewList(): boolean {
    if (this.state.phase !== "results") return false
    this.resetToStart()
    return true
  }

  pressGotIt(): boolean {
    return this.answer(true)
  }

  pressMissed(): boolean {
    return this.answer(false)
  }

  /** Study: pinching the current (pulsing) object. Returns false if ignored. */
  pinchItem(i: number): boolean {
    const st = this.state
    if (st.phase !== "study" || st.studyBusy || i !== st.currentSpot) return false
    st.studyBusy = true
    this.dwell = 0
    const spot = this.spots[i]
    spot.setPulse(false)
    spot.setPinchable(false)
    this.guide.hide()
    spot.playStudyAnimation()
    const item = spot.listItem
    const tagPos = spot.nameTagWorldPos
    this.nameTag.showName(item ? item.display : spot.spotName, tagPos, spot.facingRotation(tagPos), this.nameShowSec)
    this.later(this.nameShowSec, () => {
      if (this.state.advanceWalk()) this.focusStudySpot()
      else this.finishWalk()
    })
    return true
  }

  /** Quiz: pinching the current "?" marker reveals the item. Returns false if ignored. */
  pinchMarker(i: number): boolean {
    const st = this.state
    if (st.phase !== "quiz" || st.awaitingAnswer || i !== st.quizPos) return false
    st.awaitingAnswer = true
    st.revealedSpot = i
    const spot = this.spots[i]
    spot.reveal()
    this.guide.hide()
    const item = spot.listItem
    const tagPos = spot.nameTagWorldPos
    this.nameTag.showName(item ? item.display : spot.spotName, tagPos, spot.facingRotation(tagPos), 0)
    this.answers.showAt(spot.answerAnchor)
    return true
  }

  /** Back to the start card (New list). Also used by tests. */
  resetToStart(): void {
    this.flow += 1
    this.tween.cancelAll()
    this.voice.stopListening()
    for (const s of this.spots) s.clearItem()
    this.answers.hide()
    this.nameTag.hide()
    this.guide.hide()
    this.state = new LociState()
    this._placementOrder = []
    this._placementTimes = []
    this.setPhase("start")
    this.card.showStart()
  }

  // ── Flow ─────────────────────────────────────────────────────────────────

  private beginList(text: string, source: string): boolean {
    const phase = this.state.phase
    if (phase !== "start" && phase !== "listening") return false
    const items: ListItem[] = parseAndMatch(text, SPOT_COUNT)
    if (items.length < SPOT_COUNT) {
      this.card.setStatus(`Heard ${items.length} item${items.length === 1 ? "" : "s"} — Loci needs 5.`)
      return false
    }
    this.voice.stopListening()
    this.flow += 1
    this._lastListSource = source
    this.state.setList(items)
    this._placementOrder = []
    this._placementTimes = []
    this.setPhase("building")
    this.card.hideAll()
    this.allGlow("off")
    for (let i = 0; i < SPOT_COUNT; i++) this.spots[i].setItem(items[i])
    for (let i = 0; i < SPOT_COUNT; i++) {
      this.later(0.4 + i * DROP_INTERVAL_SEC, () => {
        this.spots[i].dropIn()
        this._placementOrder.push(i)
        this._placementTimes.push(getTime())
        this.log(`placed spot ${i + 1} (${this.spots[i].spotName}): ${this.spots[i].placedModelId} "${items[i].word}"`)
      })
    }
    this.later(0.4 + SPOT_COUNT * DROP_INTERVAL_SEC + 0.6, () => this.startWalk([0, 1, 2, 3, 4], false))
    return true
  }

  private startWalk(queue: number[], review: boolean): void {
    this.state.startWalk(queue, review)
    this.setPhase("study")
    for (const s of this.spots) {
      s.setPulse(false)
      s.setPinchable(false)
      s.setMarkerPulse(false)
    }
    this.focusStudySpot()
  }

  private focusStudySpot(): void {
    const cur = this.state.currentSpot
    this.dwell = 0
    this.spots.forEach((s, i) => {
      s.setPulse(i === cur)
      s.setPinchable(i === cur)
    })
    if (cur < 0) return
    const spot = this.spots[cur]
    this.guide.pointAt(spot.arrowWorldPos)
    this.audio.spotChime(cur, spot.surfaceWorldPos)
    this.log(`study → spot ${cur + 1} (${spot.spotName}) pulses`)
  }

  private finishWalk(): void {
    const walked = this.state.walkQueue.slice()
    this.setPhase("groupGlow")
    this.guide.hide()
    for (const s of this.spots) {
      s.setPulse(false)
      s.setPinchable(false)
    }
    walked.forEach((i) => this.spots[i].setGlow("steady"))
    this.audio.routeArpeggio(walked.map((i) => this.spots[i].surfaceWorldPos), walked)
    this.later(GROUP_GLOW_SEC, () => {
      this.allGlow("off")
      this.setPhase("switch")
      this.card.showSwitch()
    })
  }

  private startQuiz(): void {
    this.flow += 1
    this.state.resetQuiz()
    this.setPhase("quizIntro")
    this.guide.hide()
    this.nameTag.hide()
    for (const s of this.spots) {
      s.setPulse(false)
      s.setPinchable(false)
    }
    for (let i = 0; i < SPOT_COUNT; i++) {
      this.later(i * SHRINK_INTERVAL_SEC, () => this.spots[i].shrinkToMarker())
    }
    this.later(SPOT_COUNT * SHRINK_INTERVAL_SEC + 0.5, () => {
      this.setPhase("quiz")
      this.focusMarker()
    })
  }

  private focusMarker(): void {
    const cur = this.state.quizPos
    this.spots.forEach((s, i) => s.setMarkerPulse(i === cur))
    if (cur < 0 || cur >= SPOT_COUNT) return
    const spot = this.spots[cur]
    this.guide.pointAt(spot.markerArrowWorldPos)
    this.audio.spotChime(cur, spot.surfaceWorldPos)
    this.log(`quiz → marker ${cur + 1} (${spot.spotName}) pulses`)
  }

  private answer(correct: boolean): boolean {
    const st = this.state
    if (st.phase !== "quiz" || !st.awaitingAnswer) return false
    const i = st.quizPos
    const pos = this.spots[i].surfaceWorldPos
    this.answers.hide()
    this.nameTag.hide()
    if (correct) this.audio.correct(pos)
    else this.audio.missed(pos)
    const more = st.answer(correct)
    st.revealedSpot = -1
    this.log(`answer spot ${i + 1}: ${correct ? "✓" : "✗"}`)
    if (more) this.later(0.45, () => this.focusMarker())
    else this.later(0.6, () => this.showResults())
    return true
  }

  private showResults(): void {
    const st = this.state
    this.setPhase("results")
    const missed = st.missed
    this.spots.forEach((s, i) => s.setGlow(missed.indexOf(i) >= 0 ? "missed" : "off"))
    const hint = missed.length > 0 ? "Missed spots are glowing" : "All five remembered!"
    this.card.showResults(st.scoreText, hint)
    this.audio.results()
    this.log(`results ${st.scoreText}, missed ${JSON.stringify(missed.map((m) => m + 1))}`)
  }

  // ── Voice ────────────────────────────────────────────────────────────────

  private onVoicePartial(text: string): void {
    if (this.state.phase === "listening") this.card.setStatus("Heard: “" + text + "”")
  }

  private onVoiceFinal(text: string): void {
    if (this.state.phase !== "listening") return
    const items = parseAndMatch(text, SPOT_COUNT)
    if (items.length >= SPOT_COUNT) {
      this.beginList(text, "voice")
    } else {
      this.card.setStatus(`Heard ${items.length}: “${text}”. Keep going — Loci needs 5.`)
    }
  }

  private onVoiceError(message: string): void {
    if (this.state.phase !== "listening") return
    this.setPhase("start")
    this.card.setStatus(message + " — try Sample list.")
  }

  // ── Per frame: gaze dwell (extra path; pinch is the tested path) ─────────

  private onUpdate(): void {
    if (!this.started) return
    const st = this.state
    if (this.gazeDwellSec <= 0 || this.standBackCm > 0 || st.phase !== "study" || st.studyBusy) {
      this.dwell = 0
      return
    }
    const cur = st.currentSpot
    if (cur < 0) return
    const ct = this.cameraObject.getTransform()
    const toItem = this.spots[cur].itemCenterWorldPos.sub(ct.getWorldPosition()).normalize()
    const angle = Math.acos(Math.max(-1, Math.min(1, ct.back.dot(toItem)))) * (180 / Math.PI)
    if (angle < GAZE_CONE_DEG) {
      this.dwell += getDeltaTime()
      if (this.dwell >= this.gazeDwellSec) {
        this.log(`gaze dwell on spot ${cur + 1}`)
        this.pinchItem(cur)
      }
    } else {
      this.dwell = 0
    }
  }

  /**
   * DEBUG ONLY (self-test showcase screenshots): rigidly rotates the room about the
   * eye as if the user had looked down / left by the given degrees, so a straight-ahead preview
   * frame shows what the user sees while facing the table. Never called in normal use.
   */
  debugSimulateLook(pitchDownDeg: number, yawLeftDeg: number): void {
    const cam = this.cameraObject.getTransform()
    const eye = cam.getWorldPosition()
    const d2r = Math.PI / 180
    const r = quat.angleAxis(pitchDownDeg * d2r, vec3.right()).multiply(quat.angleAxis(-yawLeftDeg * d2r, vec3.up()))
    const pt = this.palaceRoot.getTransform()
    pt.setWorldPosition(eye.add(r.multiplyVec3(pt.getWorldPosition().sub(eye))))
    pt.setWorldRotation(r.multiply(pt.getWorldRotation()))
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  private later(sec: number, fn: () => void): void {
    const token = this.flow
    this.tween.delay(sec, () => {
      if (token === this.flow) fn()
    })
  }

  private allGlow(mode: "off" | "steady" | "missed"): void {
    for (const s of this.spots) s.setGlow(mode)
  }

  private setPhase(p: Phase): void {
    this.state.phase = p
    this.log("phase → " + p)
  }

  private log(msg: string): void {
    if (this.logStateChanges) print("[Loci] " + msg)
  }

  private setColliderDebugAll(root: SceneObject, on: boolean): void {
    const colliders = root.getComponents("Physics.ColliderComponent") as ColliderComponent[]
    for (const c of colliders) c.debugDrawEnabled = on
    for (let i = 0; i < root.getChildrenCount(); i++) this.setColliderDebugAll(root.getChild(i), on)
  }

  // ── Test-facing state (read-only) ─────────────────────────────────────────

  get phase(): Phase {
    return this.state.phase
  }

  /** 0-based index of the spot to act on now (study object or quiz marker); -1 if none. */
  get currentSpotIndex(): number {
    return this.state.currentSpot
  }

  /** 0-based indices of spots whose object or marker is pulsing (should be ≤ 1). */
  get pulsingSpots(): number[] {
    const out: number[] = []
    this.spots.forEach((s, i) => {
      if (s.isPulsing) out.push(i)
    })
    return out
  }

  get placedModelIds(): string[] {
    return this.spots.map((s) => s.placedModelId)
  }

  get totemTexts(): string[] {
    return this.spots.map((s) => s.totemText)
  }

  get listWords(): string[] {
    return this.state.items.map((it) => it.word)
  }

  get placementOrder(): number[] {
    return this._placementOrder.slice()
  }

  get placementTimes(): number[] {
    return this._placementTimes.slice()
  }

  get scoreText(): string {
    return this.state.phase === "results" ? this.state.scoreText : ""
  }

  get missedSpots(): number[] {
    return this.state.missed
  }

  get answersGiven(): (boolean | null)[] {
    return this.state.answers.slice()
  }

  get glowingSpots(): number[] {
    const out: number[] = []
    this.spots.forEach((s, i) => {
      if (s.isGlowing) out.push(i)
    })
    return out
  }

  get walkQueue(): number[] {
    return this.state.walkQueue.slice()
  }

  get isReviewWalk(): boolean {
    return this.state.reviewMode
  }

  get visitedSpots(): number[] {
    return this.state.visited.slice()
  }

  get markerVisibleSpots(): number[] {
    const out: number[] = []
    this.spots.forEach((s, i) => {
      if (s.isMarkerVisible) out.push(i)
    })
    return out
  }

  get revealedObjectSpots(): number[] {
    const out: number[] = []
    this.spots.forEach((s, i) => {
      if (s.isRevealed) out.push(i)
    })
    return out
  }

  get revealedSpot(): number {
    return this.state.revealedSpot
  }

  get answerButtonsVisible(): boolean {
    return this.answers.isVisible
  }

  get cardView(): string {
    return this.card.visibleView
  }

  get nameTagText(): string {
    return this.nameTag.currentText
  }

  get edgeArrowVisible(): boolean {
    return this.guide.edgeArrowVisible
  }

  get lastListSource(): string {
    return this._lastListSource
  }

  spot(i: number): LociSpot {
    return this.spots[i]
  }

  getStateJson(): string {
    return JSON.stringify({
      phase: this.phase,
      currentSpotIndex: this.currentSpotIndex,
      pulsingSpots: this.pulsingSpots,
      placedModelIds: this.placedModelIds,
      totemTexts: this.totemTexts,
      placementOrder: this.placementOrder,
      scoreText: this.scoreText,
      missedSpots: this.missedSpots,
      glowingSpots: this.glowingSpots,
      walkQueue: this.walkQueue,
      visitedSpots: this.visitedSpots,
      markerVisibleSpots: this.markerVisibleSpots,
      revealedSpot: this.revealedSpot,
      answerButtonsVisible: this.answerButtonsVisible,
      cardView: this.cardView,
      nameTagText: this.nameTagText,
    })
  }
}
