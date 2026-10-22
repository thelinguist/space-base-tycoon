import { Point } from "./iso"
import { TileMap } from "./map"

const DIRS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
]

/** Octile distance — admissible heuristic for 8-way movement. */
function heuristic(ax: number, ay: number, bx: number, by: number): number {
  const dx = Math.abs(ax - bx)
  const dy = Math.abs(ay - by)
  return Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy)
}

/**
 * A* search. 8-way movement (no cutting corners past
 * blocked tiles). Returns tiles from start to goal inclusive, or null.
 */
export function findPath(
  map: TileMap,
  start: Point,
  goal: Point,
): Point[] | null {
  if (!map.isWalkable(goal.x, goal.y)) return null

  const w = map.width
  const idx = (x: number, y: number) => y * w + x
  const startI = idx(start.x, start.y)
  const goalI = idx(goal.x, goal.y)

  const g = new Float64Array(map.width * map.height).fill(Infinity)
  const f = new Float64Array(map.width * map.height).fill(Infinity)
  const cameFrom = new Int32Array(map.width * map.height).fill(-1)
  const closed = new Uint8Array(map.width * map.height)
  const open: number[] = [startI]

  g[startI] = 0
  f[startI] = heuristic(start.x, start.y, goal.x, goal.y)

  while (open.length > 0) {
    // Linear scan is fine for small maps; swap for a heap if maps grow.
    let best = 0
    for (let i = 1; i < open.length; i++) {
      if (f[open[i]] < f[open[best]]) best = i
    }
    const current = open[best]
    open.splice(best, 1)

    if (current === goalI) {
      const path: Point[] = []
      for (let c = current; c !== -1; c = cameFrom[c]) {
        path.push({ x: c % w, y: Math.floor(c / w) })
      }
      return path.reverse()
    }

    closed[current] = 1
    const cx = current % w
    const cy = Math.floor(current / w)

    for (const [dx, dy] of DIRS) {
      const nx = cx + dx
      const ny = cy + dy
      if (!map.isWalkable(nx, ny)) continue
      // Diagonals require both orthogonal neighbours to be open.
      if (
        dx &&
        dy &&
        (!map.isWalkable(cx + dx, cy) || !map.isWalkable(cx, cy + dy))
      ) {
        continue
      }
      const n = idx(nx, ny)
      if (closed[n]) continue

      const tentative = g[current] + (dx && dy ? Math.SQRT2 : 1)
      if (tentative < g[n]) {
        if (g[n] === Infinity) open.push(n)
        cameFrom[n] = current
        g[n] = tentative
        f[n] = tentative + heuristic(nx, ny, goal.x, goal.y)
      }
    }
  }

  return null
}
