import { describe, expect, it } from "vitest"
import { TileMap } from "./map"
import { ROAM_RADIUS, ROAM_SECONDS, Spaceman } from "./spaceman"

/** Deterministic stand-in for Math.random cycling through values. */
function cycle(...values: number[]): () => number {
  let i = 0
  return () => values[i++ % values.length]
}

/** A 12×12 map with a radar at (5, 5); its south door is (5, 7). */
function setup(random = cycle(0.5, 0.9, 0.2)) {
  const map = new TileMap(12, 12)
  const station = map.place("radar", 5, 5)
  const spaceman = new Spaceman(station, { x: 5, y: 7 }, random)
  return { map, station, spaceman }
}

/** Advance in small steps, like the game ticker. */
function run(s: Spaceman, map: TileMap, seconds: number, dt = 0.1) {
  for (let t = 0; t < seconds; t += dt) s.think(map, dt)
}

describe("Spaceman", () => {
  it("steps out of the door and starts roaming", () => {
    const { map, spaceman } = setup()
    expect(spaceman.pos).toEqual({ x: 5.5, y: 7.5 })
    expect(spaceman.state).toBe("roaming")
    spaceman.think(map, 0.01)
    expect(spaceman.isMoving).toBe(true)
  })

  it("wanders within ROAM_RADIUS of the station", () => {
    const { map, spaceman } = setup(cycle(0.1, 0.99, 0.5, 0.01, 0.7))
    for (let t = 0; t < ROAM_SECONDS * 0.8; t += 0.1) {
      spaceman.think(map, 0.1)
      expect(Math.abs(spaceman.pos.x - 6)).toBeLessThanOrEqual(ROAM_RADIUS)
      expect(Math.abs(spaceman.pos.y - 6)).toBeLessThanOrEqual(ROAM_RADIUS)
    }
    expect(spaceman.state).toBe("roaming")
  })

  it("pauses between wander legs", () => {
    // Roam jitter 0.5; leg 1: idle 0.5 → 1.5s, target 0.9/0.9; leg 2: 0.1/0.1.
    const { map, spaceman } = setup(cycle(0.5, 0.5, 0.9, 0.9, 0.5, 0.1, 0.1))
    spaceman.think(map, 0.01)
    for (let i = 0; i < 1000 && spaceman.isMoving; i++)
      spaceman.think(map, 0.05)
    const { x, y } = spaceman.pos
    expect(spaceman.isMoving).toBe(false)
    spaceman.think(map, 1)
    expect(spaceman.pos).toEqual({ x, y })
    expect(spaceman.isMoving).toBe(false)
    spaceman.think(map, 0.6)
    expect(spaceman.isMoving).toBe(true)
  })

  it("roams for about 30 seconds, then walks back and goes home", () => {
    // random 0.5 → no jitter: exactly ROAM_SECONDS.
    const { map, station, spaceman } = setup(cycle(0.5, 0.9, 0.1))
    run(spaceman, map, ROAM_SECONDS - 0.5)
    expect(spaceman.state).toBe("roaming")
    run(spaceman, map, 1)
    expect(spaceman.state).toBe("returning")
    run(spaceman, map, 30)
    expect(spaceman.state).toBe("home")
    expect(map.doorsOf(station)).toContainEqual(spaceman.tile)
  })

  it("varies roam time by ±15%", () => {
    const early = setup(cycle(0, 0.9, 0.1))
    run(early.spaceman, early.map, ROAM_SECONDS * 0.86)
    expect(early.spaceman.state).not.toBe("roaming")

    const late = setup(cycle(1, 0.9, 0.1))
    run(late.spaceman, late.map, ROAM_SECONDS * 1.14)
    expect(late.spaceman.state).toBe("roaming")
  })

  it("re-plans the trip home if its route is cut short", () => {
    const { map, station, spaceman } = setup(cycle(0.5, 0.95, 0.95))
    run(spaceman, map, ROAM_SECONDS + 0.1)
    expect(spaceman.state).toBe("returning")
    spaceman.setPath([spaceman.pathStart]) // as Game does when blocked
    run(spaceman, map, 30)
    expect(spaceman.state).toBe("home")
    expect(map.doorsOf(station)).toContainEqual(spaceman.tile)
  })

  it("idles when no wander target is reachable", () => {
    // Fill everything but the door so nowhere else is walkable.
    const { map, spaceman } = setup()
    for (let y = 0; y < 12; y++) {
      for (let x = 0; x < 12; x++) {
        if (map.isWalkable(x, y) && !(x === 5 && y === 7)) {
          map.place("habitat", x, y)
        }
      }
    }
    spaceman.think(map, 0.01)
    expect(spaceman.isMoving).toBe(false)
    expect(spaceman.state).toBe("roaming")
  })

  it("heads straight inside when no door is reachable", () => {
    const { map, spaceman } = setup()
    run(spaceman, map, 5)
    // Wall it in where it stands.
    const { x, y } = spaceman.tile
    spaceman.setPath([spaceman.tile])
    spaceman.think(map, 1)
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if ((dx || dy) && map.isWalkable(x + dx, y + dy)) {
          map.place("habitat", x + dx, y + dy)
        }
      }
    }
    run(spaceman, map, ROAM_SECONDS)
    expect(spaceman.state).toBe("home")
  })
})
