import { Sprite, Texture } from "pixi.js"
import { describe, expect, it } from "vitest"
import { ICE_VARIANTS, TerrainType } from "./assets"
import { buildGround } from "./game"
import { tileToWorld } from "./iso"
import { TileMap } from "./map"
import {
  diamondToLocal,
  dust,
  TERRAIN_EFFECTS,
  TileEffects,
} from "./tileEffects"

/** Deterministic stand-in for Math.random cycling through values. */
function cycle(...values: number[]): () => number {
  let i = 0
  return () => values[i++ % values.length]
}

function effectsFor(map: TileMap, random: () => number): TileEffects {
  return new TileEffects(map, buildGround(map), random)
}

/** A 1×n strip of one terrain. */
function strip(terrain: TerrainType, n = 10): TileMap {
  const map = new TileMap(n, 1)
  for (const t of map.tiles) t.terrain = terrain
  return map
}

/** Seconds until a strip of n tiles has owed exactly one effect. */
function oneEffect(terrain: TerrainType, n = 10): number {
  return 1 / (TERRAIN_EFFECTS[terrain]!.rate * n)
}

describe("diamondToLocal", () => {
  it("maps the unit square onto the tile diamond's corners", () => {
    expect(diamondToLocal(-1, -1)).toEqual({ x: 0, y: -16 }) // top
    expect(diamondToLocal(1, -1)).toEqual({ x: 32, y: 0 }) // right
    expect(diamondToLocal(1, 1)).toEqual({ x: 0, y: 16 }) // bottom
    expect(diamondToLocal(-1, 1)).toEqual({ x: -32, y: 0 }) // left
    expect(diamondToLocal(0, 0)).toEqual({ x: 0, y: 0 })
  })
})

describe("TileEffects", () => {
  it("animates ice, rocky ground and craters but not plain regolith", () => {
    expect(Object.keys(TERRAIN_EFFECTS).sort()).toEqual([
      "crater",
      "ice",
      "rocky",
    ])
    const fx = effectsFor(strip("regolith"), cycle(0.5))
    fx.update(1000)
    expect(fx.active).toHaveLength(0)
  })

  it("plays rate × tiles effects per second on random tiles", () => {
    // Enough tiles that effects arrive well within one effect's duration.
    const n = 1000
    const fx = effectsFor(strip("ice", n), cycle(0.05, 0.95))
    const step = oneEffect("ice", n)
    fx.update(step * 0.6)
    expect(fx.active).toHaveLength(0)
    fx.update(step * 0.6) // the remainder carries over
    expect(fx.active).toHaveLength(1)
    fx.update(step * 0.9)
    expect(fx.active).toHaveLength(2)

    // Placed on the chosen tiles: floor(0.05 × n) and floor(0.95 × n).
    const [a, b] = fx.active.map((e) => e.holder.position.x)
    expect(a).toBe(tileToWorld(50, 0).x)
    expect(b).toBe(tileToWorld(950, 0).x)
    expect(fx.view!.children).toHaveLength(2)
  })

  it("removes effects once they finish", () => {
    const fx = effectsFor(strip("crater"), cycle(0.5))
    fx.update(oneEffect("crater"))
    const [effect] = fx.active
    fx.update(effect.duration * 0.5)
    expect(fx.active).toContain(effect)
    fx.update(effect.duration)
    expect(fx.active).not.toContain(effect)
    expect(effect.holder.destroyed).toBe(true)
  })

  it("forgetTile stops a tile's current and future effects", () => {
    const fx = effectsFor(strip("rocky", 1), cycle(0.5))
    fx.update(oneEffect("rocky", 1))
    const [glint] = fx.active
    fx.forgetTile({ x: 0, y: 0 })
    expect(fx.active).toHaveLength(0)
    expect(glint.holder.destroyed).toBe(true)
    fx.update(oneEffect("rocky", 1) * 5)
    expect(fx.active).toHaveLength(0)
  })

  it("forgetTile leaves other tiles' effects alone", () => {
    const fx = effectsFor(strip("rocky", 2), cycle(0.9))
    fx.update(oneEffect("rocky", 2))
    expect(fx.active[0].tile).toEqual({ x: 1, y: 0 })
    fx.forgetTile({ x: 0, y: 0 })
    expect(fx.active).toHaveLength(1)
  })

  it("puts in-air effects in the air layer", () => {
    const fx = effectsFor(strip("regolith", 1), cycle(0.5))
    fx.play({ x: 0, y: 0 }, (r) => ({ ...dust(r), inAir: true }))
    expect(fx.airView.children).toHaveLength(1)
    expect(fx.view.children).toHaveLength(0)
  })

  it("play runs a one-off effect on a tile", () => {
    const fx = effectsFor(strip("regolith", 3), cycle(0.5))
    fx.play({ x: 2, y: 0 }, dust)
    expect(fx.active).toHaveLength(1)
    expect(fx.active[0].tile).toEqual({ x: 2, y: 0 })
    expect(fx.active[0].holder.x).toBe(tileToWorld(2, 0).x)
  })

  it("skips tiles covered by buildings", () => {
    const map = strip("rocky", 1)
    map.place("habitat", 0, 0)
    const fx = effectsFor(map, cycle(0.5))
    fx.update(oneEffect("rocky", 1) * 3)
    expect(fx.active).toHaveLength(0)
  })

  it("shakes an ice tile, then shifts it to different cracks", () => {
    const map = strip("ice", 1)
    // random 0.5: tile 0, then the middle of the other variants.
    const groundLayer = buildGround(map)
    const fx = new TileEffects(map, groundLayer, cycle(0.5))
    const ground = groundLayer.children[0] as Sprite
    const before = ground.label
    const home = tileToWorld(0, 0).x
    fx.update(oneEffect("ice", 1))
    const [shift] = fx.active
    expect(shift.view).toBeNull()
    expect(fx.view.children).toHaveLength(1) // just the empty holder

    // A one-pixel jitter during the shake, settling back at the end.
    const xs = [0, 0.2, 0.4, 0.6, 0.8, 1].map((t) => {
      shift.animate(t)
      return ground.x - home
    })
    expect(xs).toEqual([1, -1, 1, 0, -1, 0])
    expect(ground.label).toBe(before)

    fx.update(shift.duration)
    expect(fx.active).toHaveLength(0)
    expect(ground.x).toBe(home)
    const others = ICE_VARIANTS.filter((v) => v !== before)
    expect(ground.label).toBe(others[1])
    expect(ground.texture).toBe(Texture.from(others[1]))
  })

  it("flares the rocky glint in and out", () => {
    const fx = effectsFor(strip("rocky", 1), cycle(0.5))
    fx.update(oneEffect("rocky", 1))
    const [glint] = fx.active
    expect(glint.view!.position.x).toBe(0) // random 0.5 → tile center
    glint.animate(0.5)
    expect(glint.view!.scale.x).toBeCloseTo(1)
    expect(glint.view!.alpha).toBeCloseTo(1)
    glint.animate(1)
    expect(glint.view!.alpha).toBeCloseTo(0)
  })

  it("drifts crater dust upward as it fades and spreads", () => {
    const fx = effectsFor(strip("crater", 1), cycle(0.5))
    fx.update(oneEffect("crater", 1))
    const [dust] = fx.active
    dust.animate(0.5)
    expect(dust.view!.y).toBe(-5)
    expect(dust.view!.scale.x).toBe(1.5)
    expect(dust.view!.alpha).toBe(0.5)
  })
})
