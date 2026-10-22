import { Assets, Texture } from "pixi.js"
import { afterEach, describe, expect, it, vi } from "vitest"
import { ASSET_NAMES, loadAssets, makeSprite } from "./assets"

afterEach(() => {
  vi.restoreAllMocks()
})

describe("assets", () => {
  it("lists every asset", () => {
    expect(ASSET_NAMES).toEqual([
      "regolith",
      "rocky",
      "crater",
      "ice",
      "habitat",
      "robot",
    ])
  })

  it("registers each asset as a 2× SVG and loads them all", async () => {
    const add = vi.spyOn(Assets, "add").mockImplementation(() => {})
    const load = vi.spyOn(Assets, "load").mockResolvedValue({})

    await loadAssets()

    expect(add).toHaveBeenCalledTimes(ASSET_NAMES.length)
    expect(add).toHaveBeenCalledWith({
      alias: "robot",
      src: "/assets/sprites/robot.svg",
      data: { resolution: 2 },
    })
    expect(load).toHaveBeenCalledWith(ASSET_NAMES)
  })

  it("makes sprites anchored at their ground point", () => {
    const tile = makeSprite("regolith")
    expect(tile.texture).toBe(Texture.from("regolith"))
    expect(tile.anchor.x).toBe(0.5)
    expect(tile.anchor.y).toBe(0.5)

    const habitat = makeSprite("habitat")
    expect(habitat.anchor.y).toBeCloseTo(56 / 72)

    const robot = makeSprite("robot")
    expect(robot.anchor.y).toBeCloseTo(36 / 40)
  })
})
