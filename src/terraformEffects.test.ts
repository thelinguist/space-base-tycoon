import { Graphics } from "pixi.js"
import { describe, expect, it, vi } from "vitest"
import {
  dirtCloud,
  LASER_HEIGHT,
  laserMelt,
  nitrogenFreeze,
  TERRAFORM_EFFECTS,
} from "./terraformEffects"
import { EffectInstance } from "./tileEffects"

const half = () => 0.5

/** Deterministic stand-in for Math.random cycling through values. */
function cycle(...values: number[]): () => number {
  let i = 0
  return () => values[i++ % values.length]
}

/** Calls made to a Graphics method while drawing frame t. */
function calls(
  effect: EffectInstance,
  method: "rect" | "circle" | "ellipse",
  t: number,
) {
  const spy = vi.spyOn(effect.view as Graphics, method)
  effect.animate(t)
  const result = spy.mock.calls as number[][]
  spy.mockRestore()
  return result
}

/** Alphas of every fill while drawing frame t. */
function alphas(effect: EffectInstance, t: number): number[] {
  const spy = vi.spyOn(effect.view as Graphics, "fill")
  effect.animate(t)
  const result = spy.mock.calls.map(([f]) => (f as { alpha: number }).alpha)
  spy.mockRestore()
  return result
}

describe("terraform effects", () => {
  it("picks an effect for each terrain terraform clears", () => {
    expect(TERRAFORM_EFFECTS).toEqual({
      crater: dirtCloud,
      rocky: laserMelt,
      ice: nitrogenFreeze,
    })
  })

  it("all play in the air, above whoever is on the tile", () => {
    for (const create of [dirtCloud, laserMelt, nitrogenFreeze]) {
      expect(create(half).inAir).toBe(true)
    }
  })

  describe("dirt cloud", () => {
    it("bursts out fast and dissipates quickly", () => {
      const cloud = dirtCloud(half)
      expect(cloud.duration).toBeLessThan(1)
      // 14 puffs + 10 specks.
      expect(calls(cloud, "rect", 0.1)).toHaveLength(24)

      // Puffs (first rect) spread out over time.
      const [early] = calls(cloud, "rect", 0.1)
      const [late] = calls(cloud, "rect", 0.6)
      expect(Math.abs(late[0])).toBeGreaterThan(Math.abs(early[0]))

      // Alpha falls off quadratically: under half by halfway.
      expect(alphas(cloud, 0)[0]).toBe(1)
      expect(alphas(cloud, 0.5)[0]).toBe(0.25)
      expect(alphas(cloud, 1)[0]).toBe(0)
    })

    it("draws on whole pixels", () => {
      for (const [x, y, w, h] of calls(dirtCloud(Math.random), "rect", 0.3)) {
        for (const v of [x, y, w, h]) expect(Number.isInteger(v)).toBe(true)
      }
    })
  })

  describe("laser", () => {
    it("flashes a beam down from overhead, then only the glow remains", () => {
      const laser = laserMelt(half)
      expect(laser.view!.blendMode).toBe("add")
      const beam = calls(laser, "rect", 0.2)
      // Glow, core, then 8 sparks.
      expect(beam).toHaveLength(10)
      const [glow, core] = beam
      expect(glow[1]).toBe(-LASER_HEIGHT)
      expect(glow[3]).toBe(LASER_HEIGHT)
      expect(core[2]).toBeLessThan(glow[2])

      // After the beam: just the 8 sparks, plus the molten puddle.
      expect(calls(laser, "rect", 0.7)).toHaveLength(8)
      expect(calls(laser, "ellipse", 0.7)).toHaveLength(1)
    })

    it("the molten rock cools to nothing", () => {
      const laser = laserMelt(half)
      // The puddle is the fill just before the 8 sparks.
      const at = (t: number) => {
        const a = alphas(laser, t)
        return a[a.length - 9]
      }
      expect(at(0.1)).toBeGreaterThan(at(0.5))
      expect(at(1)).toBe(0)
    })
  })

  describe("liquid nitrogen", () => {
    it("reaches one tile beyond the frozen tile", () => {
      const freeze = nitrogenFreeze(half)
      const [haze] = calls(freeze, "ellipse", 0.999)
      // diamondToLocal(3, -3): 1.5 tile widths out from the center.
      expect(haze[2]).toBeCloseTo(96)
      expect(haze[3]).toBeCloseTo(48)
    })

    it("sends puffs out in staggered waves", () => {
      // random 0.5 → every puff waits 0.175 of the effect.
      const freeze = nitrogenFreeze(half)
      expect(calls(freeze, "circle", 0.1)).toHaveLength(0)
      expect(calls(freeze, "circle", 0.5)).toHaveLength(52)
      const varied = nitrogenFreeze(Math.random)
      const early = calls(varied, "circle", 0.15).length
      expect(early).toBeLessThan(calls(varied, "circle", 0.5).length)
    })

    it("rolls straight outward, tumbling rather than orbiting", () => {
      // No jitter, delay or phase, full reach: follow the puff heading +x
      // (angle 0), always the right-most one.
      const freeze = nitrogenFreeze(cycle(0, 0, 1, 0, 0, 0))
      const samples = Array.from({ length: 40 }, (_, i) => {
        const circles = calls(freeze, "circle", 0.05 + i * 0.02)
        return circles.reduce((a, b) => (b[0] > a[0] ? b : a))
      })
      // It never swings back past the center, and ends up far out.
      for (const [x] of samples) expect(x).toBeGreaterThan(-6)
      expect(samples[samples.length - 1][0]).toBeGreaterThan(samples[0][0] + 50)
      // The tumble lifts it up and down as it goes.
      const ys = samples.map(([, y]) => y)
      expect(Math.min(...ys)).toBeLessThan(Math.max(...ys) - 5)
      const rises = ys.slice(1).filter((y, i) => y < ys[i]).length
      const falls = ys.slice(1).filter((y, i) => y > ys[i]).length
      expect(rises).toBeGreaterThan(0)
      expect(falls).toBeGreaterThan(0)
    })

    it("draws farther puffs first", () => {
      const ys = calls(nitrogenFreeze(Math.random), "circle", 0.6).map(
        ([, y]) => y,
      )
      expect(ys).toEqual([...ys].sort((a, b) => a - b))
    })

    it("appears quickly, then thins away", () => {
      const freeze = nitrogenFreeze(half)
      expect(alphas(freeze, 0)[0]).toBe(0)
      expect(alphas(freeze, 0.15)[0]).toBeGreaterThan(alphas(freeze, 0.8)[0])
      expect(alphas(freeze, 1)[0]).toBe(0)
    })
  })
})
