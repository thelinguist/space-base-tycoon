import { describe, expect, it } from "vitest"
import {
  gridToZIndex,
  gridToTile,
  gridToWorld,
  TILE_HEIGHT,
  TILE_WIDTH,
  tileCenter,
  tileCornersWorld,
  tileToWorld,
  worldToGrid,
  worldToTile,
} from "./iso"

describe("iso", () => {
  it("uses a 2:1 tile", () => {
    expect(TILE_WIDTH).toBe(2 * TILE_HEIGHT)
  })

  it("maps the grid axes onto the isometric diagonals", () => {
    expect(gridToWorld(0, 0)).toEqual({ x: 0, y: 0 })
    expect(gridToWorld(1, 0)).toEqual({
      x: TILE_WIDTH / 2,
      y: TILE_HEIGHT / 2,
    })
    expect(gridToWorld(0, 1)).toEqual({
      x: -TILE_WIDTH / 2,
      y: TILE_HEIGHT / 2,
    })
    expect(gridToWorld(1, 1)).toEqual({ x: 0, y: TILE_HEIGHT })
  })

  it("worldToGrid is the exact inverse of gridToWorld", () => {
    for (const [gx, gy] of [
      [0, 0],
      [3.25, 7.5],
      [31.9, 0.1],
      [-2, 5],
    ]) {
      const w = gridToWorld(gx, gy)
      const g = worldToGrid(w.x, w.y)
      expect(g.x).toBeCloseTo(gx, 10)
      expect(g.y).toBeCloseTo(gy, 10)
    }
  })

  it("floors continuous positions to tiles", () => {
    expect(gridToTile(3.99, 0.01)).toEqual({ x: 3, y: 0 })
    expect(gridToTile(-0.5, 2)).toEqual({ x: -1, y: 2 })
  })

  it("finds tile centers in grid and world space", () => {
    expect(tileCenter(2, 5)).toEqual({ x: 2.5, y: 5.5 })
    expect(tileToWorld(2, 5)).toEqual(gridToWorld(2.5, 5.5))
  })

  it("round-trips every tile center back to its tile", () => {
    for (let tx = 0; tx < 32; tx++) {
      for (let ty = 0; ty < 32; ty++) {
        const w = tileToWorld(tx, ty)
        expect(worldToTile(w.x, w.y)).toEqual({ x: tx, y: ty })
      }
    }
  })

  it("returns diamond corners clockwise from the top", () => {
    const [top, right, bottom, left] = tileCornersWorld(0, 0)
    expect(top).toEqual({ x: 0, y: 0 })
    expect(right).toEqual({ x: TILE_WIDTH / 2, y: TILE_HEIGHT / 2 })
    expect(bottom).toEqual({ x: 0, y: TILE_HEIGHT })
    expect(left).toEqual({ x: -TILE_WIDTH / 2, y: TILE_HEIGHT / 2 })
  })

  it("orders depth by distance down the screen", () => {
    expect(gridToZIndex(1, 2)).toBe(3)
    expect(gridToZIndex(5, 5)).toBeGreaterThan(gridToZIndex(5, 4))
  })
})
