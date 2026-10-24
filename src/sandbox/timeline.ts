/** Fixed simulation step, in seconds. Every run steps the game by this. */
export const STEP = 1 / 60
/** Longest real-time gap simulated in one go (e.g. after a hidden tab). */
const MAX_ADVANCE = 0.25

/**
 * What the player must do to reach the timeline's new time: optionally
 * rebuild the scene from scratch, then simulate `steps` fixed steps.
 */
export interface Plan {
  rebuild: boolean
  steps: number
}

/**
 * Time bookkeeping for a looping, replayable scene. The game only moves
 * forward, so going back means rebuilding (same seed) and replaying up
 * to the target step; determinism makes that exact.
 */
export class Timeline {
  /** Fixed steps simulated since the scene was last built. */
  steps = 0
  /** Real seconds accumulated toward the next step. */
  private carry = 0

  constructor(readonly loop: number) {}

  get time(): number {
    return this.steps * STEP
  }

  /** Steps in one loop; reaching it starts the loop over. */
  get loopSteps(): number {
    return Math.round(this.loop / STEP)
  }

  /** Real (speed-scaled) seconds passed while playing. */
  advance(seconds: number): Plan {
    this.carry += Math.min(seconds, MAX_ADVANCE)
    const n = Math.floor(this.carry / STEP)
    this.carry -= n * STEP
    const target = this.steps + n
    if (target < this.loopSteps) {
      this.steps = target
      return { rebuild: false, steps: n }
    }
    this.steps = target % this.loopSteps
    return { rebuild: true, steps: this.steps }
  }

  /** Jump to the step nearest `seconds` into the loop. */
  seek(seconds: number): Plan {
    return this.seekStep(Math.round(seconds / STEP))
  }

  stepForward(): Plan {
    return this.seekStep(this.steps + 1)
  }

  stepBack(): Plan {
    return this.seekStep(this.steps - 1)
  }

  /** Rebuild and replay to where we are, e.g. after a resize. */
  replay(): Plan {
    this.carry = 0
    return { rebuild: true, steps: this.steps }
  }

  private seekStep(step: number): Plan {
    const target = Math.max(0, Math.min(this.loopSteps - 1, step))
    this.carry = 0
    const from = this.steps
    this.steps = target
    return target >= from
      ? { rebuild: false, steps: target - from }
      : { rebuild: true, steps: target }
  }
}
