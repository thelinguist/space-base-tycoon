import { describe, expect, it } from "vitest"
import { Point } from "./iso"
import { TileMap } from "./map"
import { findPath } from "./pathfinding"

/** Build a map from rows of text: '#' is a building, anything else open. */
function mapFrom(rows: string[]): TileMap {
  const map = new TileMap(rows[0].length, rows.length)
  rows.forEach((row, y) =>
    [...row].forEach((c, x) => {
      if (c === "#") map.getTile(x, y).building = "habitat"
    }),
  )
  return map
}

function isConnected(map: TileMap, path: Point[]): boolean {
  return path.every((p, i) => {
    if (!map.isWalkable(p.x, p.y)) return false
    if (i === 0) return true
    const prev = path[i - 1]
    return Math.abs(p.x - prev.x) <= 1 && Math.abs(p.y - prev.y) <= 1
  })
}

describe("findPath", () => {
  it("returns just the start when already at the goal", () => {
    const map = new TileMap(3, 3)
    expect(findPath(map, { x: 1, y: 1 }, { x: 1, y: 1 })).toEqual([
      { x: 1, y: 1 },
    ])
  })

  it("walks straight lines", () => {
    const map = new TileMap(5, 1)
    expect(findPath(map, { x: 0, y: 0 }, { x: 4, y: 0 })).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 3, y: 0 },
      { x: 4, y: 0 },
    ])
  })

  it("moves diagonally when open", () => {
    const map = new TileMap(4, 4)
    expect(findPath(map, { x: 0, y: 0 }, { x: 3, y: 3 })).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 1 },
      { x: 2, y: 2 },
      { x: 3, y: 3 },
    ])
  })

  it("does not cut corners past buildings", () => {
    const map = mapFrom([
      ".#", //
      "..",
    ])
    expect(findPath(map, { x: 0, y: 0 }, { x: 1, y: 1 })).toEqual([
      { x: 0, y: 0 },
      { x: 0, y: 1 },
      { x: 1, y: 1 },
    ])
  })

  it("routes around walls with an optimal path", () => {
    const map = mapFrom([
      ".....", //
      ".###.",
      "...#.",
      ".#.#.",
      ".....",
    ])
    const path = findPath(map, { x: 2, y: 2 }, { x: 4, y: 0 })!
    expect(path[0]).toEqual({ x: 2, y: 2 })
    expect(path[path.length - 1]).toEqual({ x: 4, y: 0 })
    expect(isConnected(map, path)).toBe(true)
    // No diagonal shortcuts past wall ends: 2,2 → 2,3 → 2,4 → 3,4 → 4,4 →
    // 4,3 → 4,2 → 4,1 → 4,0 (or the mirror-image route over the top).
    expect(path).toHaveLength(9)
  })

  it("goes around an enclosure rather than into it", () => {
    const map = mapFrom([
      "......", //
      ".####.",
      ".#..#.",
      ".#..#.",
      "......",
    ])
    const path = findPath(map, { x: 0, y: 4 }, { x: 5, y: 0 })!
    expect(isConnected(map, path)).toBe(true)
    // Along two sides of the box; no diagonal can cut its corners.
    expect(path).toHaveLength(10)
  })

  it("improves the cost of a tile already queued via a worse route", () => {
    // (2,0) is first queued diagonally from (1,1) at cost 2√2, then reached
    // more cheaply from (1,0) at cost 2; A* must keep the better route.
    const map = mapFrom([
      "...", //
      "...",
      ".#.",
    ])
    expect(findPath(map, { x: 0, y: 0 }, { x: 2, y: 2 })).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 1 },
      { x: 2, y: 1 },
      { x: 2, y: 2 },
    ])
  })

  it("returns null when the goal is blocked or out of bounds", () => {
    const map = mapFrom(["..#"])
    expect(findPath(map, { x: 0, y: 0 }, { x: 2, y: 0 })).toBeNull()
    expect(findPath(map, { x: 0, y: 0 }, { x: 9, y: 0 })).toBeNull()
  })

  it("returns null when the goal is unreachable", () => {
    const map = mapFrom([
      "...", //
      "###",
      "...",
    ])
    expect(findPath(map, { x: 0, y: 0 }, { x: 2, y: 2 })).toBeNull()
  })
})
