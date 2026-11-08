/**
 * LociState — the single owner of session state (pure logic, no scene access).
 *
 * Owns: current phase, the 5 list items, the study walk queue + position, and the
 *       Find-it quiz: seeded prompt order, current prompt, per-spot answers, score
 *       and the missed list.
 * Must not: touch SceneObjects, UI or audio — LociMain reads this and drives views.
 */

import {ListItem} from "./LociParser"

export type Phase =
  | "start" // start card visible
  | "listening" // "Say my list" — waiting for speech
  | "building" // objects dropping onto spots
  | "study" // walking the route, one spot pulses
  | "groupGlow" // all walked spots glow together (2 s)
  | "switch" // "Walk again" / "Quiz me"
  | "quizIntro" // objects vanishing into neutral markers
  | "quiz" // "Where's the …?" — pinch the spot where it was
  | "results" // score card + missed glow

export const SPOT_COUNT = 5

/** Deterministic PRNG (mulberry32): same seed, same sequence. */
export function seededRandom(seed: number): () => number {
  let a = Math.floor(seed) >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Seeded Fisher–Yates order of 0..n-1. Never returns plain route order (n > 1), so the
 * quiz can't be answered by walking the route left to right.
 */
export function seededShuffle(n: number, seed: number): number[] {
  const rnd = seededRandom(seed)
  for (let attempt = 0; attempt < 16; attempt++) {
    const a: number[] = []
    for (let i = 0; i < n; i++) a.push(i)
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1))
      const tmp = a[i]
      a[i] = a[j]
      a[j] = tmp
    }
    if (n < 2 || a.some((v, i) => v !== i)) return a
  }
  const rev: number[] = []
  for (let i = n - 1; i >= 0; i--) rev.push(i)
  return rev
}

/** Per-round seed: rounds of the same list differ, but every run is reproducible. */
export function quizRoundSeed(baseSeed: number, round: number): number {
  return Math.floor(baseSeed) * 1000 + round * 7919 + 17
}

export interface Guess {
  target: number // spot whose item was asked
  pinched: number // spot the user pinched
  correct: boolean
}

export class LociState {
  phase: Phase = "start"
  items: ListItem[] = []

  // Study walk
  walkQueue: number[] = []
  walkPos = 0
  reviewMode = false
  /** True between a study pinch and the move to the next spot (name showing). */
  studyBusy = false
  visited: number[] = []

  // Find-it quiz
  /** How many quizzes this list has started (0 before the first "Quiz me"). */
  quizRound = 0
  /** Spot indices in the order their items are asked. */
  quizOrder: number[] = []
  /** Index into quizOrder of the current prompt. */
  quizStep = 0
  /** Per spot: true = found on the first pinch, false = missed, null = not asked yet. */
  answers: (boolean | null)[] = [null, null, null, null, null]
  /** True while a prompt is up and the next pinch counts as the guess. */
  awaitingGuess = false
  /** Spots asked so far, in prompt order. */
  asked: number[] = []
  guesses: Guess[] = []
  /** Spot whose object is currently shown as feedback (-1 when none). */
  revealedSpot = -1

  setList(items: ListItem[]): void {
    this.items = items.slice(0, SPOT_COUNT)
    this.quizRound = 0
    this.resetQuiz()
  }

  startWalk(queue: number[], review: boolean): void {
    this.phase = "study"
    this.walkQueue = queue.slice()
    this.walkPos = 0
    this.reviewMode = review
    this.studyBusy = false
    this.visited = []
  }

  /** Spot the user should act on in the study walk (0-based), or -1. */
  get currentSpot(): number {
    if (this.phase === "study") {
      return this.walkPos < this.walkQueue.length ? this.walkQueue[this.walkPos] : -1
    }
    return -1
  }

  /** Advances the walk; returns true while spots remain. */
  advanceWalk(): boolean {
    const cur = this.currentSpot
    if (cur >= 0) this.visited.push(cur)
    this.walkPos += 1
    this.studyBusy = false
    return this.walkPos < this.walkQueue.length
  }

  resetQuiz(): void {
    this.quizOrder = []
    this.quizStep = 0
    this.answers = [null, null, null, null, null]
    this.awaitingGuess = false
    this.asked = []
    this.guesses = []
    this.revealedSpot = -1
  }

  /** New quiz round: score back to 0 and a fresh seeded prompt order. */
  beginQuiz(baseSeed: number): void {
    this.resetQuiz()
    this.quizOrder = seededShuffle(SPOT_COUNT, quizRoundSeed(baseSeed, this.quizRound))
    this.quizRound += 1
  }

  /** Spot whose item the current prompt asks for, or -1. */
  get quizTarget(): number {
    return this.quizStep < this.quizOrder.length ? this.quizOrder[this.quizStep] : -1
  }

  /** Records the first pinch for the current prompt. */
  recordGuess(pinched: number): Guess {
    const target = this.quizTarget
    const g: Guess = {target, pinched, correct: pinched === target}
    if (target >= 0) this.answers[target] = g.correct
    this.guesses.push(g)
    this.awaitingGuess = false
    return g
  }

  /** Moves to the next prompt; returns true while prompts remain. */
  nextPrompt(): boolean {
    this.quizStep += 1
    return this.quizStep < this.quizOrder.length
  }

  get score(): number {
    return this.answers.filter((a) => a === true).length
  }

  get missed(): number[] {
    const out: number[] = []
    this.answers.forEach((a, i) => {
      if (a === false) out.push(i)
    })
    return out
  }

  get scoreText(): string {
    return `${this.score} / ${SPOT_COUNT}`
  }
}
