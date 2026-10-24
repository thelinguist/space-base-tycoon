import { describe, expect, it } from "vitest"
import {
  BUILDING_SIZE,
  footprint,
  footprintCenter,
  generateMap,
  TileMap,
} from "./map"

describe("TileMap", () => {
  it("starts as empty regolith", () => {
    const map = new TileMap(3, 2)
    expect(map.tiles).toHaveLength(6)
    expect(map.getTile(2, 1)).toEqual({ terrain: "regolith", building: null })
  })

  it("stores tiles row-major", () => {
    const map = new TileMap(3, 2)
    map.getTile(1, 1).terrain = "ice"
    expect(map.tiles[4].terrain).toBe("ice")
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
    map.place("habitat", 1, 1)
    expect(map.isWalkable(0, 0)).toBe(true)
    expect(map.isWalkable(1, 1)).toBe(false)
    expect(map.isWalkable(5, 5)).toBe(false)
  })
})

describe("footprints", () => {
  it("sizes habitats 1×1 and radar stations 2×2", () => {
    expect(BUILDING_SIZE).toEqual({ habitat: 1, radar: 2 })
    expect(footprint("habitat", 3, 4)).toEqual([{ x: 3, y: 4 }])
    expect(footprint("radar", 3, 4)).toEqual([
      { x: 3, y: 4 },
      { x: 4, y: 4 },
      { x: 3, y: 5 },
      { x: 4, y: 5 },
    ])
  })

  it("centers on the footprint", () => {
    expect(footprintCenter("habitat", 3, 4)).toEqual({ x: 3.5, y: 4.5 })
    expect(footprintCenter("radar", 3, 4)).toEqual({ x: 4, y: 5 })
  })

  it("places a building on every footprint tile", () => {
    const map = new TileMap(4, 4)
    const radar = map.place("radar", 1, 1)
    expect(radar).toEqual({ type: "radar", x: 1, y: 1 })
    expect(map.buildings).toEqual([radar])
    for (const t of footprint("radar", 1, 1)) {
      expect(map.getTile(t.x, t.y).building).toBe(radar)
    }
    expect(map.getTile(0, 0).building).toBeNull()
  })

  it("canPlace needs the whole footprint empty, in bounds and buildable", () => {
    const map = new TileMap(4, 4)
    expect(map.canPlace("radar", 0, 0)).toBe(true)
    expect(map.canPlace("radar", 3, 0)).toBe(false) // hangs off the edge
    map.getTile(1, 1).terrain = "crater"
    expect(map.canPlace("radar", 0, 0)).toBe(false)
    map.getTile(1, 1).terrain = "rocky"
    expect(map.canPlace("radar", 0, 0)).toBe(true)
    map.getTile(1, 1).terrain = "ice"
    expect(map.canPlace("radar", 0, 0)).toBe(false)
    map.place("habitat", 2, 2)
    expect(map.canPlace("radar", 2, 1)).toBe(false)
  })

  it("lists walkable edge-adjacent tiles as doors", () => {
    const map = new TileMap(4, 4)
    const radar = map.place("radar", 0, 0)
    // Top and left sides are off the map.
    expect(map.doorsOf(radar)).toEqual([
      { x: 2, y: 0 },
      { x: 0, y: 2 },
      { x: 2, y: 1 },
      { x: 1, y: 2 },
    ])
    map.place("habitat", 2, 0)
    expect(map.doorsOf(radar)).toHaveLength(3)
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
      expect(t.building?.type).toBe("habitat")
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
    expect(regolith.every((t) => t.building?.type === "habitat")).toBe(true)
  })

  it("places nothing when the whole map is reserved", () => {
    const map = generateMap(3, 3, 1337, { x: 1, y: 1 })
    expect(map.tiles.every((t) => t.building === null)).toBe(true)
  })
})
