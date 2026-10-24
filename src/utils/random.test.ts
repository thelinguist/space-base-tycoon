import { describe, expect, it } from "vitest"
import { seededRandom } from "./random"

describe("seededRandom", () => {
  it("repeats the same sequence for the same seed", () => {
    const a = seededRandom(42)
    const b = seededRandom(42)
    const seqA = Array.from({ length: 20 }, a)
    expect(Array.from({ length: 20 }, b)).toEqual(seqA)
    const c = seededRandom(43)
    expect(Array.from({ length: 20 }, c)).not.toEqual(seqA)
  })

  it("stays in [0, 1) and spreads values out", () => {
    const r = seededRandom(7)
    const values = Array.from({ length: 10_000 }, r)
    for (const v of values) {
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
    const mean = values.reduce((s, v) => s + v, 0) / values.length
    expect(mean).toBeCloseTo(0.5, 1)
    expect(new Set(values).size).toBeGreaterThan(9_990)
  })
})
