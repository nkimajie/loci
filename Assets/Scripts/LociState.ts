/**
 * LociState — the single owner of session state (pure logic, no scene access).
 *
 * Owns: current phase, the 5 list items, the study walk queue + position,
 *       quiz position, answers, score and the missed list.
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
  | "quizIntro" // objects shrinking into "?" markers
  | "quiz" // pinch marker -> reveal -> answer
  | "results" // score card + missed glow

export const SPOT_COUNT = 5

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

  // Quiz
  quizPos = 0
  answers: (boolean | null)[] = [null, null, null, null, null]
  awaitingAnswer = false
  revealedSpot = -1

  setList(items: ListItem[]): void {
    this.items = items.slice(0, SPOT_COUNT)
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

  /** Spot the user should act on right now (0-based), or -1. */
  get currentSpot(): number {
    if (this.phase === "study") {
      return this.walkPos < this.walkQueue.length ? this.walkQueue[this.walkPos] : -1
    }
    if (this.phase === "quiz") return this.quizPos < SPOT_COUNT ? this.quizPos : -1
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
    this.quizPos = 0
    this.answers = [null, null, null, null, null]
    this.awaitingAnswer = false
    this.revealedSpot = -1
  }

  /** Records an answer for the current marker; returns true while markers remain. */
  answer(correct: boolean): boolean {
    this.answers[this.quizPos] = correct
    this.awaitingAnswer = false
    this.quizPos += 1
    return this.quizPos < SPOT_COUNT
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
