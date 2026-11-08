/**
 * LociTween — tiny frame-driven tween + timer helper shared by Loci components.
 *
 * Owns: a list of running tweens / delayed calls, advanced by its host
 *       component's UpdateEvent.
 * Expects: a host BaseScriptComponent passed to the constructor.
 * Must not: touch scene state itself — callers mutate transforms inside their
 *           update callbacks.
 */

export type EaseFn = (t: number) => number

export const Ease = {
  linear: (t: number) => t,
  inQuad: (t: number) => t * t,
  outQuad: (t: number) => 1 - (1 - t) * (1 - t),
  inOutSine: (t: number) => 0.5 - 0.5 * Math.cos(Math.PI * t),
  outBack: (t: number) => {
    const c1 = 1.70158
    const c3 = c1 + 1
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2)
  },
  outBounce: (t: number) => {
    const n1 = 7.5625
    const d1 = 2.75
    if (t < 1 / d1) return n1 * t * t
    if (t < 2 / d1) {
      t -= 1.5 / d1
      return n1 * t * t + 0.75
    }
    if (t < 2.5 / d1) {
      t -= 2.25 / d1
      return n1 * t * t + 0.9375
    }
    t -= 2.625 / d1
    return n1 * t * t + 0.984375
  },
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

export function clamp01(t: number): number {
  return t < 0 ? 0 : t > 1 ? 1 : t
}

interface Job {
  elapsed: number
  duration: number
  update?: (t: number) => void
  done?: () => void
  cancelled: boolean
}

export class TweenHandle {
  constructor(private job: Job) {}
  cancel(): void {
    this.job.cancelled = true
  }
  get active(): boolean {
    return !this.job.cancelled && this.job.elapsed < this.job.duration
  }
}

export class Tweener {
  private jobs: Job[] = []

  constructor(host: BaseScriptComponent) {
    host.createEvent("UpdateEvent").bind(() => this.tick(getDeltaTime()))
  }

  /** Runs update(t) every frame with t in 0..1 over `duration` seconds, then done(). */
  tween(duration: number, update: (t: number) => void, done?: () => void): TweenHandle {
    const job: Job = {elapsed: 0, duration: Math.max(0.0001, duration), update, done, cancelled: false}
    this.jobs.push(job)
    update(0)
    return new TweenHandle(job)
  }

  /** Calls fn once after `seconds`. */
  delay(seconds: number, fn: () => void): TweenHandle {
    const job: Job = {elapsed: 0, duration: Math.max(0.0001, seconds), done: fn, cancelled: false}
    this.jobs.push(job)
    return new TweenHandle(job)
  }

  cancelAll(): void {
    for (const j of this.jobs) j.cancelled = true
    this.jobs = []
  }

  private tick(dt: number): void {
    if (this.jobs.length === 0) return
    const current = this.jobs.slice()
    for (const job of current) {
      if (job.cancelled) continue
      job.elapsed += dt
      const t = Math.min(1, job.elapsed / job.duration)
      if (job.update) job.update(t)
      if (t >= 1) {
        job.cancelled = true
        if (job.done) job.done()
      }
    }
    this.jobs = this.jobs.filter((j) => !j.cancelled)
  }
}
