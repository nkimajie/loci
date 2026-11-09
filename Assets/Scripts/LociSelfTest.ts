/**
 * LociSelfTest — scripted check of the brief's 5 done criteria (debug only).
 *
 * Runs when LociMain.runSelfTest is ticked. Drives the same action methods the
 * pinch targets call (pressErrands, pinchItem, guessSpot, pressReviewMissed, …),
 * reads LociMain's test-facing state, and prints "[LociSelfTest] PASS/FAIL C<n>".
 * This verifies flow logic; the SIK pinch path itself is covered by LEAF tests.
 * Must not: ship enabled — LociMain.runSelfTest defaults to false.
 */

import {Tweener} from "./LociTween"

interface LociTestTarget {
  phase: string
  currentSpotIndex: number
  pulsingSpots: number[]
  placedModelIds: string[]
  totemTexts: string[]
  listWords: string[]
  placementOrder: number[]
  placementTimes: number[]
  scoreText: string
  missedSpots: number[]
  glowingSpots: number[]
  walkQueue: number[]
  visitedSpots: number[]
  markerVisibleSpots: number[]
  revealedObjectSpots: number[]
  revealedSpot: number
  quizOrder: number[]
  quizTargetSpot: number
  awaitingGuess: boolean
  cardView: string
  nameShowSec: number
  pressStudyPack(): boolean
  pressErrands(): boolean
  pressMixedList(): boolean
  pressQuizMe(): boolean
  pressReviewMissed(): boolean
  pinchItem(i: number): boolean
  guessSpot(i: number): boolean
  resetToStart(): void
  debugSimulateLook(pitchDownDeg: number, yawLeftDeg: number): void
  getStateJson(): string
}

interface Step {
  wait: number
  run: () => void
}

const same = (a: any[], b: any[]) => JSON.stringify(a) === JSON.stringify(b)

/** Where the self-test leaves the preview afterwards: "start" | "study" | "quiz" | "results". */
const SHOWCASE_END: string = "start"
/** true = skip the criteria checks and go straight to the showcase. */
const SHOWCASE_ONLY: boolean = false
/** Which preset list the showcase uses: "mixed" | "errands" | "study". */
const SHOWCASE_LIST: string = "mixed"
/** Once parked, re-aim the view as if the user looked down / left by these degrees (0, 0 = off). */
const SHOWCASE_LOOK_DOWN_DEG: number = 0
const SHOWCASE_LOOK_LEFT_DEG: number = 0

export function runLociSelfTest(main: LociTestTarget, tween: Tweener): void {
  const fails: {[c: string]: string[]} = {C1: [], C2: [], C3: [], C4: [], C5: []}
  const check = (c: string, ok: boolean, msg: string) => {
    if (!ok) fails[c].push(msg + " | state=" + main.getStateJson())
  }
  const N = main.nameShowSec
  let monitoring = false
  let maxPulsing = 0
  tween.tween(120, () => {
    if (monitoring) maxPulsing = Math.max(maxPulsing, main.pulsingSpots.length)
  })

  // Find-it: every item found on the first try except the milk (spot 3), which gets a wrong spot.
  const MISSED_SPOT = 2
  const guessFor = (target: number): number => {
    if (target !== MISSED_SPOT) return target
    for (let i = 0; i < 5; i++) if (i !== target && main.revealedObjectSpots.indexOf(i) < 0) return i
    return target
  }
  const steps: Step[] = []
  if (SHOWCASE_ONLY) {
    steps.push({wait: 0.8, run: () => void (SHOWCASE_LIST === "errands" ? main.pressErrands() : SHOWCASE_LIST === "study" ? main.pressStudyPack() : main.pressMixedList())})
    steps.push({wait: 4.4, run: () => {}})
  } else {
  steps.push({
    wait: 0.8,
    run: () => {
      check("C1", main.phase === "start" && main.cardView === "start", "start card not showing at launch")
      check("C1", main.pressErrands(), "Errands press ignored")
      monitoring = true
    },
  })
  steps.push({
    wait: 1.3,
    run: () => {
      const n = main.placementOrder.length
      check("C1", n >= 1 && n <= 4, `objects should arrive one at a time; ${n} placed 1.3 s in`)
    },
  })
  steps.push({
    wait: 3.0,
    run: () => {
      check("C1", same(main.placementOrder, [0, 1, 2, 3, 4]), "placement order " + JSON.stringify(main.placementOrder))
      const t = main.placementTimes
      let gaps = true
      for (let i = 1; i < t.length; i++) if (t[i] - t[i - 1] < 0.3) gaps = false
      check("C1", gaps && t.length === 5, "placements not spaced one at a time: " + JSON.stringify(t))
      check("C1", same(main.placedModelIds, ["umbrella", "key", "milk", "phone", "gift"]), "models " + JSON.stringify(main.placedModelIds))
      check("C2", main.phase === "study" && main.currentSpotIndex === 0, "study should start at spot 1")
      check("C2", same(main.pulsingSpots, [0]), "only spot 1 should pulse, got " + JSON.stringify(main.pulsingSpots))
    },
  })
  for (let k = 0; k < 5; k++) {
    steps.push({
      wait: 0.2,
      run: () => {
        if (k < 4) check("C2", !main.pinchItem(k + 1), `pinching non-current spot ${k + 2} should be ignored`)
        check("C2", main.pinchItem(k), `pinch on current spot ${k + 1} ignored`)
      },
    })
    steps.push({
      wait: N + 0.45,
      run: () => {
        if (k < 4) {
          check("C2", main.currentSpotIndex === k + 1, `pulse should move to spot ${k + 2}`)
          check("C2", same(main.pulsingSpots, [k + 1]), `only spot ${k + 2} should pulse, got ${JSON.stringify(main.pulsingSpots)}`)
        } else {
          check("C2", main.phase === "groupGlow", "after spot 5 all should glow together")
          check("C2", same(main.glowingSpots, [0, 1, 2, 3, 4]), "group glow spots " + JSON.stringify(main.glowingSpots))
        }
      },
    })
  }
  steps.push({
    wait: 2.3,
    run: () => {
      check("C2", main.phase === "switch" && main.cardView === "switch", "'Quiz me' card should appear after spot 5")
      check("C3", main.pressQuizMe(), "Quiz me press ignored")
    },
  })
  for (let k = 0; k < 5; k++) {
    steps.push({
      wait: k === 0 ? 2.8 : 3.0,
      run: () => {
        if (k === 0) {
          check("C3", main.phase === "quiz", "quiz phase not reached")
          check("C3", same(main.markerVisibleSpots, [0, 1, 2, 3, 4]), "all 5 spots should show markers: " + JSON.stringify(main.markerVisibleSpots))
          check("C3", main.revealedObjectSpots.length === 0, "objects should vanish behind markers")
          check("C3", same(main.quizOrder.slice().sort(), [0, 1, 2, 3, 4]), "prompt order should cover every item: " + JSON.stringify(main.quizOrder))
        }
        const target = main.quizTargetSpot
        check("C3", main.awaitingGuess && target >= 0, `prompt ${k + 1} should be waiting for a pinch`)
        check("C3", main.guessSpot(guessFor(target)), `guess for prompt ${k + 1} ignored`)
      },
    })
  }
  steps.push({
    wait: 3.3,
    run: () => {
      check("C4", main.phase === "results", "results not shown")
      check("C4", main.scoreText === "4 / 5", "score text '" + main.scoreText + "'")
      check("C4", main.cardView === "results", "results card not visible")
      check("C4", same(main.missedSpots, [2]) && same(main.glowingSpots, [2]), "only spot 3 should glow: " + JSON.stringify(main.glowingSpots))
      check("C4", main.pressReviewMissed(), "Review missed press ignored")
    },
  })
  steps.push({
    wait: 0.5,
    run: () => {
      check("C4", main.phase === "study" && same(main.walkQueue, [2]), "review should walk only spot 3: " + JSON.stringify(main.walkQueue))
      check("C4", same(main.pulsingSpots, [2]), "review: only spot 3 should pulse")
      check("C4", main.pinchItem(2), "review pinch on spot 3 ignored")
    },
  })
  steps.push({
    wait: N + 0.45,
    run: () => {
      check("C4", same(main.visitedSpots, [2]) && main.phase === "groupGlow", "review should end after spot 3: " + JSON.stringify(main.visitedSpots))
    },
  })
  steps.push({
    wait: 2.3,
    run: () => {
      monitoring = false
      check("C2", maxPulsing <= 1, "more than one spot pulsed at once (max " + maxPulsing + ")")
      main.resetToStart()
      check("C5", main.pressMixedList(), "Mixed list press ignored")
    },
  })
  steps.push({
    wait: 4.4,
    run: () => {
      check("C5", same(main.listWords, ["umbrella", "keys", "volcano", "mobile", "gift"]), "mixed words " + JSON.stringify(main.listWords))
      check("C5", main.placedModelIds[1] === "key", "'keys' should place the key model (plural)")
      check("C5", main.placedModelIds[3] === "phone", "'mobile' should place the phone model (synonym)")
      check("C5", main.placedModelIds[2] === "totem" && main.totemTexts[2] === "volcano", "table centre should be a word totem 'volcano'")
      const report: string[] = []
      for (const c of ["C1", "C2", "C3", "C4", "C5"]) {
        const ok = fails[c].length === 0
        report.push(`${c}:${ok ? "PASS" : "FAIL"}`)
        print(`[LociSelfTest] ${ok ? "PASS" : "FAIL"} ${c}${ok ? "" : " — " + fails[c].join(" || ")}`)
      }
      print("[LociSelfTest] SUMMARY " + report.join(" "))
      if (SHOWCASE_END === "start") main.resetToStart()
    },
  })
  }

  // Optional showcase tail: leaves the preview parked in a state for visual review.
  if (SHOWCASE_END === "quiz" || SHOWCASE_END === "results") {
    for (let k = 0; k < 5; k++) {
      steps.push({wait: 0.2, run: () => void main.pinchItem(k)})
      steps.push({wait: N + 0.45, run: () => {}})
    }
    steps.push({wait: 2.3, run: () => void main.pressQuizMe()})
    if (SHOWCASE_END === "results") {
      for (let k = 0; k < 5; k++) {
        steps.push({wait: k === 0 ? 2.8 : 3.0, run: () => void main.guessSpot(guessFor(main.quizTargetSpot))})
      }
      steps.push({wait: 3.3, run: () => {}})
    }
  }
  steps.push({
    wait: 1.0,
    run: () => {
      if (SHOWCASE_END === "start") main.resetToStart()
      if (SHOWCASE_LOOK_DOWN_DEG !== 0 || SHOWCASE_LOOK_LEFT_DEG !== 0) main.debugSimulateLook(SHOWCASE_LOOK_DOWN_DEG, SHOWCASE_LOOK_LEFT_DEG)
      print("[LociSelfTest] showcase parked (" + SHOWCASE_END + "): " + main.getStateJson())
    },
  })

  let i = 0
  const runNext = () => {
    if (i >= steps.length) return
    const s = steps[i++]
    tween.delay(s.wait, () => {
      try {
        s.run()
      } catch (e) {
        print("[LociSelfTest] step error: " + e)
      }
      runNext()
    })
  }
  print("[LociSelfTest] starting")
  runNext()
}
