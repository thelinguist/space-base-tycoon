/**
 * Isometric (2.5D) coordinate system.
 *
 * There are three coordinate spaces in the game:
 *
 *  - Grid space   — the 2D game logic in x,y coordinates. Game state lives here.
 *  - World space  — pixel coordinates inside the camera's world container,
 *                   AFTER the isometric projection. Grid (0, 0) maps to
 *                   world (0, 0), the top corner of tile (0, 0).
 *  - Screen space — pixel coordinates on the canvas (pointer events).
 *                   World to/from screen is handled by the Camera (pan / zoom).
 *
 * Every conversion between grid and world MUST go through this module.
 */

/** Width of a tile's diamond in world pixels. */
export const TILE_WIDTH = 64 // double height because it's 2.5d
/** Height of a tile's diamond in world pixels (2:1 dimetric projection). */
export const TILE_HEIGHT = 32

const HALF_W = TILE_WIDTH / 2
const HALF_H = TILE_HEIGHT / 2

export interface Point {
  x: number
  y: number
}

/**
 * Grid (game) space → world (view) space.
 * One step in +gx moves right and down on screen: (+32, +16).
 * One step in +gy moves left and down on screen: (−32, +16).
 *
 *       grid (logic)                    world (screen)
 *
 *      (0,0)──(1,0)──(2,0)  → +gx               (0,0)
 *        │      │      │                       ╱     ╲
 *      (0,1)──(1,1)──(2,1)                (0,1)       (1,0)
 *        │      │      │                   ╱   ╲     ╱   ╲
 *        ↓ +gy                        (0,2)     (1,1)     (2,0)
 *                                      +gy ↙               ↘ +gx
 *
 */
export function gridToWorld(gx: number, gy: number): Point {
  return {
    x: (gx - gy) * HALF_W,
    y: (gx + gy) * HALF_H,
  }
}

/** World space → grid space (continuous; exact inverse of gridToWorld). */
export function worldToGrid(wx: number, wy: number): Point {
  const a = wx / HALF_W // gx - gy
  const b = wy / HALF_H // gx + gy
  return {
    x: (a + b) / 2,
    y: (b - a) / 2,
  }
}

/** The tile containing a continuous grid position. */
export function gridToTile(gx: number, gy: number): Point {
  return { x: Math.floor(gx), y: Math.floor(gy) }
}

/** Grid position of a tile's center. */
export function tileCenter(tx: number, ty: number): Point {
  return { x: tx + 0.5, y: ty + 0.5 }
}

/** World position of a tile's center — where tile sprites are anchored. */
export function tileToWorld(tx: number, ty: number): Point {
  const c = tileCenter(tx, ty)
  return gridToWorld(c.x, c.y)
}

/** The tile under a world-space point. */
export function worldToTile(wx: number, wy: number): Point {
  const g = worldToGrid(wx, wy)
  return gridToTile(g.x, g.y)
}

/** World-space corners of a tile's diamond: top, right, bottom, left. */
export function tileCornersWorld(tx: number, ty: number): Point[] {
  return [
    gridToWorld(tx, ty),
    gridToWorld(tx + 1, ty),
    gridToWorld(tx + 1, ty + 1),
    gridToWorld(tx, ty + 1),
  ]
}

/**
 * Draw-order key for objects standing on the ground. Objects further
 * "down" the screen (larger gx + gy) are drawn on top.
 */
export function gridToZIndex(gx: number, gy: number): number {
  return gx + gy
}
