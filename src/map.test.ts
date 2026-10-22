import { describe, expect, it } from "vitest"
import { generateMap, TileMap } from "./map"

describe("TileMap", () => {
  it("starts as empty regolith", () => {
    const map = new TileMap(3, 2)
    expect(map.tiles).toHaveLength(6)
    expect(map.getTile(2, 1)).toEqual({ terrain: "regolith", building: null })
  })

  it("stores tiles row-major", () => {
    const map = new TileMap(3, 2)
    map.getTile(1, 1).building = "habitat"
    expect(map.tiles[4].building).toBe("habitat")
  })

  it("checks bounds", () => {
    const map = new TileMap(3, 2)
    expect(map.isInBounds(0, 0)).toBe(true)
    expect(map.isInBounds(2, 1)).toBe(true)
    expect(map.isInBounds(-1, 0)).toBe(false)
    expect(map.isInBounds(0, -1)).toBe(false)
    expect(map.isInBounds(3, 0)).toBe(false)
    expect(map.isInBounds(0, 2)).toBe(false)
  })

  it("is walkable in bounds and where there is no building", () => {
    const map = new TileMap(3, 3)
    map.getTile(1, 1).building = "habitat"
    expect(map.isWalkable(0, 0)).toBe(true)
    expect(map.isWalkable(1, 1)).toBe(false)
    expect(map.isWalkable(5, 5)).toBe(false)
  })
})

describe("generateMap", () => {
  const center = { x: 16, y: 16 }

  it("is deterministic for a seed", () => {
    expect(generateMap(32, 32, 1337, center).tiles).toEqual(
      generateMap(32, 32, 1337, center).tiles,
    )
    expect(generateMap(32, 32, 1337, center).tiles).not.toEqual(
      generateMap(32, 32, 42, center).tiles,
    )
  })

  it("produces every terrain type", () => {
    const map = generateMap(32, 32, 1337, center)
    const terrains = new Set(map.tiles.map((t) => t.terrain))
    expect(terrains).toEqual(new Set(["regolith", "rocky", "crater", "ice"]))
  })

  it("places 14 habitats, only on regolith", () => {
    const map = generateMap(32, 32, 1337, center)
    const built = map.tiles.filter((t) => t.building)
    expect(built).toHaveLength(14)
    for (const t of built) {
      expect(t.building).toBe("habitat")
      expect(t.terrain).toBe("regolith")
    }
  })

  it("keeps the 3×3 area around the start clear", () => {
    const map = generateMap(32, 32, 1337, center)
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        expect(map.getTile(center.x + dx, center.y + dy).building).toBeNull()
      }
    }
  })

  it("gives up after a bounded number of attempts on a crowded map", () => {
    // A 3×3 map can't fit 14 habitats, so placement must stop by attempt
    // count, filling every regolith tile along the way.
    const map = generateMap(3, 3, 1337, { x: 100, y: 100 })
    const regolith = map.tiles.filter((t) => t.terrain === "regolith")
    expect(regolith.length).toBeGreaterThan(0)
    expect(regolith.every((t) => t.building === "habitat")).toBe(true)
  })

  it("places nothing when the whole map is reserved", () => {
    const map = generateMap(3, 3, 1337, { x: 1, y: 1 })
    expect(map.tiles.every((t) => t.building === null)).toBe(true)
  })
})
