import { Point } from "./iso"
import { Building, footprintCenter, TileMap } from "./map"
import { findPath } from "./pathfinding"
import { Walker } from "./walker"

/** Movement speed in tiles per second; a leisurely moonwalk. */
const SPEED = 1.5
/** Average time spent roaming before heading home. */
export const ROAM_SECONDS = 30
/** Roam time varies by ±this fraction so spacemen don't leave in lockstep. */
const ROAM_JITTER = 0.15
/** How far from the station's center a spaceman will wander, in tiles. */
export const ROAM_RADIUS = 5
/** Attempts at picking a reachable wander target before idling again. */
const WANDER_TRIES = 8
/** Pause between wander legs, in seconds: MIN + random × RANGE. */
const IDLE_MIN = 0.5
const IDLE_RANGE = 2

export type SpacemanState = "roaming" | "returning" | "home"

/**
 * A crew member who steps out of a station, wanders nearby for about
 * ROAM_SECONDS, then walks back to any of the station's doors. Once
 * `state` is "home" the owner should remove it.
 */
export class Spaceman extends Walker {
  state: SpacemanState = "roaming"
  private roamLeft: number
  private idleLeft = 0

  constructor(
    readonly station: Building,
    door: Point,
    private readonly random: () => number,
  ) {
    super("spaceman", door.x, door.y, SPEED)
    this.roamLeft = ROAM_SECONDS * (1 + ROAM_JITTER * (2 * random() - 1))
  }

  think(map: TileMap, deltaSeconds: number): void {
    this.update(deltaSeconds)
    if (this.state === "roaming") {
      this.roamLeft -= deltaSeconds
      if (this.roamLeft <= 0) {
        this.goHome(map)
      } else if (!this.isMoving) {
        this.idleLeft -= deltaSeconds
        if (this.idleLeft <= 0) this.wander(map)
      }
    } else if (this.state === "returning" && !this.isMoving) {
      // Arrived, or had the route cut short by new construction.
      if (this.isAtDoor(map)) this.state = "home"
      else this.goHome(map)
    }
  }

  private wander(map: TileMap): void {
    this.idleLeft = IDLE_MIN + this.random() * IDLE_RANGE
    const { type, x, y } = this.station
    const c = footprintCenter(type, x, y)
    for (let i = 0; i < WANDER_TRIES; i++) {
      const target = {
        x: Math.floor(c.x + (this.random() * 2 - 1) * ROAM_RADIUS),
        y: Math.floor(c.y + (this.random() * 2 - 1) * ROAM_RADIUS),
      }
      const path = findPath(map, this.pathStart, target)
      if (path) {
        this.setPath(path)
        return
      }
    }
  }

  private goHome(map: TileMap): void {
    this.state = "returning"
    // Shortest route to any door; with no way back, just head inside.
    let best: Point[] | null = null
    for (const door of map.doorsOf(this.station)) {
      const path = findPath(map, this.pathStart, door)
      if (path && (!best || path.length < best.length)) best = path
    }
    if (best) this.setPath(best)
    else this.state = "home"
  }

  private isAtDoor(map: TileMap): boolean {
    const { x, y } = this.tile
    return map.doorsOf(this.station).some((d) => d.x === x && d.y === y)
  }
}
