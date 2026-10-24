import { describe, expect, it } from "vitest"
import { STEP, Timeline } from "./timeline"

describe("Timeline", () => {
  it("counts fixed 60 Hz steps over the loop", () => {
    const tl = new Timeline(2)
    expect(STEP).toBe(1 / 60)
    expect(tl.loopSteps).toBe(120)
    expect(tl.time).toBe(0)
  })

  it("turns real time into whole steps, carrying the remainder", () => {
    const tl = new Timeline(2)
    expect(tl.advance(STEP * 2.5)).toEqual({ rebuild: false, steps: 2 })
    expect(tl.advance(STEP * 0.6)).toEqual({ rebuild: false, steps: 1 })
    expect(tl.steps).toBe(3)
    expect(tl.time).toBeCloseTo(0.05)
  })

  it("caps long gaps so a hidden tab doesn't fast-forward", () => {
    const tl = new Timeline(10)
    expect(tl.advance(5).steps).toBe(15) // 0.25s
  })

  it("wraps around at the end of the loop by rebuilding", () => {
    const tl = new Timeline(0.1) // 6 steps
    tl.advance(STEP * 5.5)
    expect(tl.advance(STEP * 2)).toEqual({ rebuild: true, steps: 1 })
    expect(tl.steps).toBe(1)
  })

  it("seeks forward by simulating, backward by replaying", () => {
    const tl = new Timeline(2)
    expect(tl.seek(1)).toEqual({ rebuild: false, steps: 60 })
    expect(tl.seek(1.5)).toEqual({ rebuild: false, steps: 30 })
    expect(tl.seek(0.5)).toEqual({ rebuild: true, steps: 30 })
    expect(tl.steps).toBe(30)
  })

  it("clamps seeks to the loop", () => {
    const tl = new Timeline(1)
    tl.seek(5)
    expect(tl.steps).toBe(59)
    tl.seek(-1)
    expect(tl.steps).toBe(0)
  })

  it("steps one frame either way", () => {
    const tl = new Timeline(1)
    expect(tl.stepForward()).toEqual({ rebuild: false, steps: 1 })
    expect(tl.stepForward()).toEqual({ rebuild: false, steps: 1 })
    expect(tl.stepBack()).toEqual({ rebuild: true, steps: 1 })
    expect(tl.stepBack()).toEqual({ rebuild: true, steps: 0 })
    // Can't go before the start.
    expect(tl.stepBack()).toEqual({ rebuild: false, steps: 0 })
  })

  it("replays to the current step, dropping any carried time", () => {
    const tl = new Timeline(2)
    tl.advance(STEP * 10.9)
    expect(tl.replay()).toEqual({ rebuild: true, steps: 10 })
    expect(tl.advance(STEP * 0.5).steps).toBe(0)
  })
})
