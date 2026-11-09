/**
 * LociMain — orchestrates the Loci memory-palace session:
 *   start card → list (Study pack / Errands / Mixed / voice) → objects drop onto 5 spots in route
 *   order → study walk (one spot pulses) → group glow → Walk again / Quiz me →
 *   Find-it quiz (objects vanish into neutral markers; "Where's the <item>?" in a seeded
 *   shuffled order; pinch the spot: green ring if right, red shake + orange-ring reveal of
 *   the right spot if wrong) → results ("4 / 5", missed glow) → Review missed /
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
 * visitedSpots, markerVisibleSpots, revealedObjectSpots, revealedSpot, quizOrder,
 * quizStep, quizTargetSpot, askedSpots, promptText, promptIconModelId, lastGuess,
 * ringKinds, shakingSpots, quizScore, cardView, getStateJson();
 * lastListSource ("study" | "errands" | "mixed" | "voice");
 * actions press*() / pinchItem(i) / guessSpot(i).
 */

import {LociAudio} from "./LociAudio"
import {LociCardUI} from "./LociCardUI"
import {LociGuide} from "./LociGuide"
import {buildModel, buildTotem} from "./LociModelBuilder"
import {findModel} from "./LociModelLibrary"
import {LociNameTagUI} from "./LociNameTagUI"
import {ListItem, parseAndMatch} from "./LociParser"
import {runLociSelfTest} from "./LociSelfTest"
import {LociShapeKit} from "./LociShapeKit"
import {LociSpot} from "./LociSpot"
import {Guess, LociState, Phase, SPOT_COUNT} from "./LociState"
import {LociVoice} from "./LociVoice"
import {Tweener} from "./LociTween"

// Timings dictated by the brief ("glow together for 2 seconds") or pure pacing.
const GROUP_GLOW_SEC = 2.0
const DROP_INTERVAL_SEC = 0.55
const SHRINK_INTERVAL_SEC = 0.3
const GAZE_CONE_DEG = 6
// Find-it feedback pacing.
const FOUND_HOLD_SEC = 1.3 // green ring + name before the next prompt
const SHAKE_SEC = 0.6 // wrong spot shakes red
const WRONG_REVEAL_HOLD_SEC = 1.6 // right spot shows its object with an orange ring
// Preview framing: the card floats this far in front of the camera, in the free band
// above or below the route (whichever the start view has room for).
const PREVIEW_CARD_DISTANCE_CM = 90
const PREVIEW_CARD_HEIGHT_CM = 28 // tallest view (start card) incl. padding
const PREVIEW_CARD_WIDTH_CM = 19
const DEG = Math.PI / 180
// Preview stand-back only: room x of the route's visual midpoint (chair's left edge
// −100 cm, shelf's right edge +112 cm), so the start view is centred on the route.
const PREVIEW_ROUTE_CENTER_X_CM = 5
// Preview stand-back only: the start view looks down at the route at this pitch
// (route in the upper half, card below the table spots).
const PREVIEW_VIEW_PITCH_DEG = -16

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
  @hint("Start / switch / prompt / results card")
  card!: LociCardUI

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
  @hint("Text the 'Study pack' button sends through the list parser (route order): the scientific method, one step per spot")
  studyPackText: string = "ask a question, research, hypothesis, experiment, conclusion"

  @input
  @hint("Text the 'Errands (warm-up)' button sends through the list parser (route order)")
  errandsListText: string = "umbrella, keys, milk, call mom, gift"

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

  @input
  @hint("Seed for the Find-it prompt order (same seed → same order every run; each new quiz round reshuffles deterministically)")
  quizSeed: number = 7
  @ui.group_end

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Lens Studio preview only (ignored on Specs)</span>')
  @ui.group_start("Preview")
  @input
  @hint("Preview camera starts this far behind the user's spot (the user's spot is 0.5 m from the table front). The Specs view is only ~32° wide, so from the user's spot the chair and shelf are out of frame; 320 fits the whole route with a margin. The card then floats 0.9 m in front of the camera so its text stays readable. 0 = start at the user's spot. While > 0, gaze dwell is off in the preview (the camera is a recording view, not the user's eyes).")
  @widget(new SliderWidget(0, 400, 10))
  previewStandBackCm: number = 320
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
  private _promptIconId = ""

  onAwake(): void {
    this.tween = new Tweener(this)
    this.spots = [this.spot1, this.spot2, this.spot3, this.spot4, this.spot5]
    const missing: string[] = []
    const refs: {[k: string]: any} = {
      cameraObject: this.cameraObject, palaceRoot: this.palaceRoot, shapeKit: this.shapeKit, audio: this.audio,
      voice: this.voice, guide: this.guide, card: this.card, nameTag: this.nameTag,
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
      // In the Find-it quiz the hidden spot itself and its marker are both guess targets.
      s.onItemPinched.add((i) => (this.state.phase === "quiz" ? this.guessSpot(i) : this.pinchItem(i)))
      s.onMarkerPinched.add((i) => this.guessSpot(i))
    }
    this.placeCardForPreview()
    if (this.standBackCm > 0) {
      // Name tags are sized for ~1.1 m; scale them with the preview camera's distance to the route.
      const d = this.spots[2].surfaceWorldPos.sub(this.eyeWorld).length
      this.nameTag.setViewScale(Math.min(2.5, Math.max(1, (d / 110) * 0.65)))
    }
    this.card.onSayList.add(() => this.pressSayList())
    this.card.onStudyPack.add(() => this.pressStudyPack())
    this.card.onErrands.add(() => this.pressErrands())
    this.card.onMixedList.add(() => this.pressMixedList())
    this.card.onWalkAgain.add(() => this.pressWalkAgain())
    this.card.onQuizMe.add(() => this.pressQuizMe())
    this.card.onReviewMissed.add(() => this.pressReviewMissed())
    this.card.onQuizAgain.add(() => this.pressQuizAgain())
    this.card.onNewList.add(() => this.pressNewList())
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
   * direction (centred on the route sideways), so the camera starts that far behind the
   * user's spot.
   */
  private alignPalace(): void {
    const cam = this.cameraObject.getTransform()
    const p = cam.getWorldPosition()
    const look = cam.back
    const yaw = Math.atan2(-look.x, -look.z)
    const sy = Math.sin(yaw)
    const cy = Math.cos(yaw)
    let shift = vec3.zero()
    if (this.standBackCm > 0) {
      const ahead = new vec3(-sy, 0, -cy).uniformScale(this.standBackCm)
      const roomRight = new vec3(cy, 0, -sy)
      shift = ahead.sub(roomRight.uniformScale(PREVIEW_ROUTE_CENTER_X_CM))
    }
    const pt = this.palaceRoot.getTransform()
    pt.setWorldPosition(new vec3(p.x, p.y - this.eyeHeightCm, p.z).add(shift))
    pt.setWorldRotation(quat.angleAxis(yaw, vec3.up()))
    if (this.standBackCm > 0) {
      // The preview camera's start pitch is editor workspace state and can come back level
      // after a restart. Tilt the room about the eye instead, so the start view always
      // looks down at the route at PREVIEW_VIEW_PITCH_DEG whatever the camera pitch is.
      const pitch = Math.asin(Math.max(-1, Math.min(1, look.y)))
      const tilt = pitch - PREVIEW_VIEW_PITCH_DEG * DEG
      if (Math.abs(tilt) > 0.5 * DEG) {
        const r = quat.angleAxis(tilt, new vec3(cy, 0, -sy))
        pt.setWorldPosition(p.add(r.multiplyVec3(pt.getWorldPosition().sub(p))))
        pt.setWorldRotation(r.multiply(pt.getWorldRotation()))
        this.log(`preview camera pitch ${(pitch / DEG).toFixed(1)}° → room tilted ${(tilt / DEG).toFixed(1)}° so the route reads as from a ${PREVIEW_VIEW_PITCH_DEG}° look-down`)
      }
    }
  }

  /**
   * Preview only: the card floats PREVIEW_CARD_DISTANCE_CM in front of the camera, facing
   * it, in whichever free band of the start view is bigger — below the table spots when the
   * camera looks down at the route, above the route when it starts level — so the card text
   * stays readable without covering any spot.
   */
  private placeCardForPreview(): void {
    if (this.standBackCm <= 0) return
    const camT = this.cameraObject.getTransform()
    const eye = camT.getWorldPosition()
    const look = camT.back
    const yaw = Math.atan2(-look.x, -look.z)
    const fwd = new vec3(-Math.sin(yaw), 0, -Math.cos(yaw))
    const right = new vec3(Math.cos(yaw), 0, -Math.sin(yaw))
    const pitch = Math.asin(Math.max(-1, Math.min(1, look.y)))
    const cam = this.cameraObject.getComponent("Component.Camera") as Camera
    const halfV = cam && cam.fov > 0 ? cam.fov / 2 : 18 * DEG
    const elev = (p: vec3) => {
      const d = p.sub(eye)
      return Math.atan2(d.y, Math.sqrt(d.x * d.x + d.z * d.z))
    }
    const halfW = Math.atan(PREVIEW_CARD_WIDTH_CM / 2 / PREVIEW_CARD_DISTANCE_CM)
    let top = -Math.PI / 2
    let lowInBand = Math.PI / 2
    for (const sp of this.spots) {
      top = Math.max(top, elev(sp.nameTagWorldPos.add(new vec3(0, 8, 0))))
      const d = sp.surfaceWorldPos.sub(eye)
      const az = Math.atan2(d.dot(right), d.dot(fwd))
      if (Math.abs(az) < halfW + 4 * DEG) {
        // Lowest point that matters in the card's column: the spot's surface, pulled toward the camera.
        const near = sp.surfaceWorldPos.add(fwd.uniformScale(-sp.objectSizeCm * 0.8))
        lowInBand = Math.min(lowInBand, elev(near))
      }
    }
    if (lowInBand > Math.PI / 4) lowInBand = top - 10 * DEG
    const halfH = Math.atan(PREVIEW_CARD_HEIGHT_CM / 2 / PREVIEW_CARD_DISTANCE_CM)
    const gap = 1.5 * DEG
    const frameTop = pitch + halfV
    const frameBottom = pitch - halfV
    const roomBelow = lowInBand - gap - (frameBottom + gap)
    const roomAbove = frameTop - gap - (top + gap)
    let e: number
    if (roomBelow >= roomAbove) {
      e = Math.max(lowInBand - gap - halfH, frameBottom + gap + halfH) // hug the route, stay in frame
    } else {
      e = Math.min(top + gap + halfH, frameTop - gap - halfH)
    }
    const dir = fwd.uniformScale(Math.cos(e)).add(vec3.up().uniformScale(Math.sin(e)))
    const pos = eye.add(dir.uniformScale(PREVIEW_CARD_DISTANCE_CM))
    const ct = this.card.getSceneObject().getTransform()
    ct.setWorldPosition(pos)
    ct.setWorldRotation(quat.lookAt(eye.sub(pos).normalize(), vec3.up()))
    this.log(`preview card ${PREVIEW_CARD_DISTANCE_CM} cm in front of the camera, ${(e / DEG).toFixed(1)}° elevation ` +
      `(camera pitch ${(pitch / DEG).toFixed(1)}°, vfov ${((2 * halfV) / DEG).toFixed(1)}°, route ${(top / DEG).toFixed(1)}°…${(lowInBand / DEG).toFixed(1)}°, ` +
      `room ${roomBelow >= roomAbove ? "below" : "above"} ${((Math.max(roomBelow, roomAbove) - 2 * halfH) / DEG).toFixed(1)}° spare)`)
  }

  // ── Actions (UI events and tests both call these) ─────────────────────────

  pressStudyPack(): boolean {
    return this.beginList(this.studyPackText, "study")
  }

  pressErrands(): boolean {
    return this.beginList(this.errandsListText, "errands")
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

  /**
   * Find-it: the user pinched spot `i` (its marker or the hidden spot) as the answer to
   * the current prompt. First pinch only; returns false if ignored.
   */
  guessSpot(i: number): boolean {
    const st = this.state
    if (st.phase !== "quiz" || !st.awaitingGuess || i < 0 || i >= SPOT_COUNT) return false
    if (this.spots[i].isRevealed) return false // already found — not a candidate any more
    const g = st.recordGuess(i)
    for (const s of this.spots) s.setPinchable(false)
    const target = this.spots[g.target]
    const item = target.listItem
    const tagPos = target.nameTagWorldPos
    this.log(`find-it: asked spot ${g.target + 1} (${item ? item.word : "?"}), pinched spot ${i + 1} → ${g.correct ? "correct" : "wrong"}`)
    if (g.correct) {
      st.revealedSpot = g.target
      target.reveal(false)
      target.setGlow("off")
      target.showRing("green", FOUND_HOLD_SEC)
      this.audio.correct(target.surfaceWorldPos)
      this.nameTag.showName(item ? item.display : target.spotName, tagPos, target.facingRotation(tagPos), 0)
      this.later(FOUND_HOLD_SEC + 0.3, () => this.finishPrompt())
    } else {
      const wrong = this.spots[i]
      wrong.shakeWrong(SHAKE_SEC)
      this.audio.missed(wrong.surfaceWorldPos)
      this.later(SHAKE_SEC, () => {
        st.revealedSpot = g.target
        target.reveal(true)
        target.setGlow("off")
        target.showRing("orange", WRONG_REVEAL_HOLD_SEC)
        this.nameTag.showName(item ? item.display : target.spotName, tagPos, target.facingRotation(tagPos), 0)
      })
      this.later(SHAKE_SEC + WRONG_REVEAL_HOLD_SEC, () => {
        // Brief reveal only: the missed object goes back under a neutral marker.
        st.revealedSpot = -1
        this.nameTag.hide()
        target.shrinkToMarker()
        target.setGlow("neutral")
      })
      this.later(SHAKE_SEC + WRONG_REVEAL_HOLD_SEC + 0.5, () => this.finishPrompt())
    }
    return true
  }

  /** Back to the start card (New list). Also used by tests. */
  resetToStart(): void {
    this.flow += 1
    this.tween.cancelAll()
    this.voice.stopListening()
    for (const s of this.spots) s.clearItem()
    this.card.clearPromptIcon()
    this._promptIconId = ""
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

  /** Find-it: objects vanish into neutral markers, then the first prompt appears. */
  private startQuiz(): void {
    this.flow += 1
    this.state.beginQuiz(this.quizSeed)
    this.setPhase("quizIntro")
    this.guide.hide()
    this.nameTag.hide()
    for (const s of this.spots) {
      s.setPulse(false)
      s.setPinchable(false)
      s.setMarkerPulse(false)
      s.clearRing()
    }
    for (let i = 0; i < SPOT_COUNT; i++) {
      this.later(i * SHRINK_INTERVAL_SEC, () => {
        this.spots[i].shrinkToMarker()
        this.spots[i].setGlow("neutral")
      })
    }
    this.log(`find-it order (seed ${this.quizSeed}, round ${this.state.quizRound}): ${JSON.stringify(this.state.quizOrder.map((k) => k + 1))}`)
    this.later(SPOT_COUNT * SHRINK_INTERVAL_SEC + 0.5, () => {
      this.setPhase("quiz")
      this.askPrompt()
    })
  }

  /** Puts up "Where's the <item>?" for the current prompt; every hidden spot becomes a guess target. */
  private askPrompt(): void {
    const st = this.state
    const target = st.quizTarget
    if (target < 0) {
      this.showResults()
      return
    }
    const item = st.items[target] || this.spots[target].listItem
    const name = item ? item.display : this.spots[target].spotName
    st.asked.push(target)
    st.awaitingGuess = true
    st.revealedSpot = -1
    this.spots.forEach((s) => s.setPinchable(!s.isRevealed))
    this.buildPromptIcon(target)
    this.card.showPrompt(this.promptQuestion(target), "Pinch the spot where it was", `${st.quizStep + 1} of ${SPOT_COUNT}`)
    this.log(`find-it prompt ${st.quizStep + 1}/${SPOT_COUNT}: ${name} (answer: spot ${target + 1})`)
  }

  /**
   * "Where's the umbrella?", "Where are the keys?", "Where's the hypothesis?".
   * Phrases ask for the thing they name: "ask a question" → "the question" (the words
   * after an article); "call mom" → the matched object's name ("the phone").
   */
  private promptQuestion(spotIndex: number): string {
    const item = this.state.items[spotIndex] || this.spots[spotIndex].listItem
    if (!item) return "Where was it?"
    let noun = item.word.toLowerCase()
    if (noun.indexOf(" ") >= 0) {
      const afterArticle = /\b(?:a|an|the)\s+(.+)$/.exec(noun)
      const def = item.modelId ? findModel(item.modelId) : null
      if (afterArticle) noun = afterArticle[1]
      else if (def) noun = def.displayName.toLowerCase()
    }
    // Simple plurals only: "keys" yes; "hypothesis", "glass", "virus" no.
    const plural = noun.indexOf(" ") < 0 && noun.length > 3 && /[^siu]s$/.test(noun)
    return plural ? `Where are the ${noun}?` : `Where's the ${noun}?`
  }

  private finishPrompt(): void {
    this.nameTag.hide()
    this.state.revealedSpot = -1
    if (this.state.nextPrompt()) this.askPrompt()
    else this.later(0.3, () => this.showResults())
  }

  /** Small 3D copy of the asked item's model (or word totem) for the prompt card. */
  private buildPromptIcon(spotIndex: number): void {
    this.card.clearPromptIcon()
    const item = this.state.items[spotIndex] || this.spots[spotIndex].listItem
    if (!item) {
      this._promptIconId = ""
      return
    }
    const host = this.card.promptIconHost
    const slot = this.card.promptIconSizeCm
    const holder = global.scene.createSceneObject("PromptIconModel")
    holder.setParent(host)
    const def = item.modelId ? findModel(item.modelId) : null
    if (def) {
      const unit = slot * 0.8
      holder.getTransform().setLocalPosition(new vec3(0, -unit * 0.45, 0))
      buildModel(this.shapeKit, holder, def, unit)
      this._promptIconId = def.id
    } else {
      const unit = slot * 0.45
      holder.getTransform().setLocalPosition(new vec3(0, -unit * 0.6, 0))
      buildTotem(this.shapeKit, holder, item.word, spotIndex, unit)
      this._promptIconId = "totem"
    }
  }

  private showResults(): void {
    const st = this.state
    this.setPhase("results")
    st.awaitingGuess = false
    // Bring every object back so the whole route is there to review.
    for (const s of this.spots) {
      s.setPinchable(false)
      s.clearRing()
      if (!s.isRevealed) s.reveal(false)
    }
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
    this.card.setStatus(message + " — try Study pack.")
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

  /** 0-based index of the spot to act on in the study walk; -1 otherwise (Find-it never points). */
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

  /** Find-it: spot indices in the order their items are asked (seeded shuffle). */
  get quizOrder(): number[] {
    return this.state.quizOrder.slice()
  }

  /** Find-it: 0-based index of the current prompt (5 when all are done). */
  get quizStep(): number {
    return this.state.quizStep
  }

  /** Find-it: spot whose item the current prompt asks for (-1 outside the quiz). */
  get quizTargetSpot(): number {
    return this.state.phase === "quiz" ? this.state.quizTarget : -1
  }

  /** Find-it: true while the prompt is waiting for its (first) pinch. */
  get awaitingGuess(): boolean {
    return this.state.phase === "quiz" && this.state.awaitingGuess
  }

  get askedSpots(): number[] {
    return this.state.asked.slice()
  }

  get guesses(): Guess[] {
    return this.state.guesses.slice()
  }

  get lastGuess(): Guess | null {
    const g = this.state.guesses
    return g.length > 0 ? g[g.length - 1] : null
  }

  /** Correct first tries so far in the current quiz round. */
  get quizScore(): number {
    return this.state.score
  }

  get quizRound(): number {
    return this.state.quizRound
  }

  get promptText(): string {
    return this.card.promptText
  }

  get promptProgress(): string {
    return this.card.promptProgress
  }

  /** Model id of the prompt card's 3D icon ("totem" for word totems, "" when none). */
  get promptIconModelId(): string {
    return this.card.visibleView === "prompt" ? this._promptIconId : ""
  }

  /** Per spot: feedback ring showing ("", "green" or "orange"). */
  get ringKinds(): string[] {
    return this.spots.map((s) => s.ringKind)
  }

  get shakingSpots(): number[] {
    const out: number[] = []
    this.spots.forEach((s, i) => {
      if (s.isShaking) out.push(i)
    })
    return out
  }

  get pinchableSpots(): number[] {
    const out: number[] = []
    this.spots.forEach((s, i) => {
      if (s.isPinchable) out.push(i)
    })
    return out
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

  /** Start card offers "Say my list" (always on Specs; in the preview only if the card's showVoiceInPreview is on). */
  get voiceButtonShown(): boolean {
    return this.card.voiceButtonShown
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
      revealedObjectSpots: this.revealedObjectSpots,
      quizOrder: this.quizOrder,
      quizStep: this.quizStep,
      quizTargetSpot: this.quizTargetSpot,
      askedSpots: this.askedSpots,
      answers: this.answersGiven,
      ringKinds: this.ringKinds,
      cardView: this.cardView,
      promptText: this.promptText,
      nameTagText: this.nameTagText,
    })
  }
}
