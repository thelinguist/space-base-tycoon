import { describe, expect, it } from "vitest"
import { hash, perlinNoise, valueNoise } from "./noise"

type Noise = (x: number, y: number, scale: number, seed: number) => number

/** Sample a noise function over a grid of fractional points. */
function sample(noise: Noise, scale: number, seed: number): number[] {
  const out: number[] = []
  for (let y = 0; y < 40; y += 0.37) {
    for (let x = 0; x < 40; x += 0.37) out.push(noise(x, y, scale, seed))
  }
  return out
}

describe("hash", () => {
  it("is deterministic", () => {
    expect(hash(5, 9, 1337)).toBe(hash(5, 9, 1337))
  })

  it("returns values in [0, 1)", () => {
    for (let i = 0; i < 1000; i++) {
      const h = hash(i, -i * 3, i % 7)
      expect(h).toBeGreaterThanOrEqual(0)
      expect(h).toBeLessThan(1)
    }
  })

  it("changes with every input", () => {
    const base = hash(5, 9, 1337)
    expect(hash(6, 9, 1337)).not.toBe(base)
    expect(hash(5, 10, 1337)).not.toBe(base)
    expect(hash(5, 9, 1338)).not.toBe(base)
  })

  it("is roughly uniform", () => {
    const buckets = new Array(10).fill(0)
    for (let i = 0; i < 10000; i++) buckets[Math.floor(hash(i, 0, 1) * 10)]++
    for (const count of buckets) {
      expect(count).toBeGreaterThan(850)
      expect(count).toBeLessThan(1150)
    }
  })
})

describe.each([
  ["valueNoise", valueNoise],
  ["perlinNoise", perlinNoise],
] as const)("%s", (_, noise) => {
  it("is deterministic", () => {
    expect(noise(3.3, 7.7, 5, 42)).toBe(noise(3.3, 7.7, 5, 42))
  })

  it("stays within [0, 1]", () => {
    for (const v of sample(noise, 3, 9)) {
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThanOrEqual(1)
    }
  })

  it("is continuous: nearby points have nearby values", () => {
    for (let x = 0; x < 20; x += 0.1) {
      const step = Math.abs(noise(x + 0.01, 4.2, 5, 1) - noise(x, 4.2, 5, 1))
      expect(step).toBeLessThan(0.02)
    }
  })

  it("varies across the map", () => {
    const values = sample(noise, 5, 1)
    expect(Math.max(...values) - Math.min(...values)).toBeGreaterThan(0.4)
  })

  it("depends on the seed", () => {
    expect(sample(noise, 5, 1)).not.toEqual(sample(noise, 5, 2))
  })

  it("scale stretches the pattern", () => {
    expect(noise(6, 4, 10, 3)).toBeCloseTo(noise(3, 2, 5, 3), 12)
  })
})

describe("valueNoise", () => {
  it("equals the lattice hash exactly on lattice points", () => {
    expect(valueNoise(14, 21, 7, 5)).toBe(hash(2, 3, 5))
    expect(valueNoise(0, 0, 7, 5)).toBe(hash(0, 0, 5))
  })
})

describe("perlinNoise", () => {
  it("is exactly 0.5 on lattice points", () => {
    expect(perlinNoise(14, 21, 7, 5)).toBe(0.5)
    expect(perlinNoise(0, 0, 7, 5)).toBe(0.5)
  })

  it("averages about 0.5", () => {
    const values = sample(perlinNoise, 5, 1)
    const mean = values.reduce((a, b) => a + b, 0) / values.length
    expect(mean).toBeGreaterThan(0.4)
    expect(mean).toBeLessThan(0.6)
  })
})
