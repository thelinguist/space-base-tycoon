import { Graphics } from "pixi.js"
import { describe, expect, it, vi } from "vitest"
import { TileMap } from "../map"
import { seededRandom } from "../utils/random"
import { drawGrid } from "./grid"
import { makeMap } from "./scene"
import { findScene, SCENES } from "./scenes"
import { STEP } from "./timeline"

const ctx = (seed = 1) => ({
  random: seededRandom(seed),
  viewport: { width: 800, height: 600 },
})

/** Simulate a scene's game for some seconds at the sandbox's fixed step. */
function run(id: string, seconds: number, seed = 1) {
  const game = findScene(id)!.build(ctx(seed))
  for (let i = 0; i < Math.round(seconds / STEP); i++) game.update(STEP)
  return game
}

describe("scene registry", () => {
  it("lists the radar and terraform scenes with unique ids", () => {
    expect(SCENES.map((s) => s.name)).toEqual([
      "Radar / Crew spawning",
      "Terraform / Crater",
      "Terraform / Rocky",
      "Terraform / Ice",
    ])
    expect(new Set(SCENES.map((s) => s.id)).size).toBe(SCENES.length)
  })

  it("finds scenes by id", () => {
    expect(findScene("terraform-rocky")!.name).toBe("Terraform / Rocky")
    expect(findScene("missing")).toBeUndefined()
  })
})

describe("makeMap", () => {
  it("fills regolith with the given terrain overrides", () => {
    const map = makeMap(3, 2, [[2, 1, "ice"]])
    expect(map.width).toBe(3)
    expect(map.getTile(2, 1).terrain).toBe("ice")
    expect(map.getTile(0, 0).terrain).toBe("regolith")
    expect(makeMap(2, 2).tiles.every((t) => t.terrain === "regolith")).toBe(
      true,
    )
  })
})

describe("terraform scenes", () => {
  for (const terrain of ["crater", "rocky", "ice"] as const) {
    it(`the robot clears the ${terrain} within the loop`, () => {
      const scene = findScene(`terraform-${terrain}`)!
      const game = scene.build(ctx())
      expect(game.map.getTile(3, 2).terrain).toBe(terrain)
      expect(game.robots[0].tool).toBe("terraform")

      const done = run(scene.id, scene.loop - 1)
      expect(done.map.getTile(3, 2).terrain).toBe("regolith")
      expect(done.robots[0].tile).toEqual({ x: 3, y: 2 })
    })
  }
})

describe("radar scene", () => {
  it("sends crew out who roam and head home within the loop", () => {
    const scene = findScene("radar-crew")!
    expect(scene.build(ctx()).map.buildings).toEqual([
      { type: "radar", x: 5, y: 5 },
    ])
    expect(run(scene.id, 1).spacemen.length).toBeGreaterThan(0)
    // The first spaceman (out at t≈0) roams and is home by loop's end.
    const game = run(scene.id, 0.1)
    const first = game.spacemen[0]
    for (let t = 0.1; t < scene.loop - 0.1; t += STEP) game.update(STEP)
    expect(first.state).toBe("home")
    expect(game.spacemen).not.toContain(first)
  })

  it("replays identically for the same seed", () => {
    const a = run("radar-crew", 12, 5).spacemen.map((s) => s.pos)
    const b = run("radar-crew", 12, 5).spacemen.map((s) => s.pos)
    expect(a).toEqual(b)
  })
})

describe("drawGrid", () => {
  it("draws a line along every tile edge", () => {
    const g = new Graphics()
    const moveTo = vi.spyOn(g, "moveTo")
    const stroke = vi.spyOn(g, "stroke")
    expect(drawGrid(g, new TileMap(3, 2))).toBe(g)
    // (height + 1) + (width + 1) lines.
    expect(moveTo).toHaveBeenCalledTimes(3 + 4)
    expect(stroke).toHaveBeenCalledOnce()
  })
})
