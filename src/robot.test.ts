import { describe, expect, it } from "vitest"
import { gridToWorld, tileToWorld } from "./iso"
import { Robot } from "./robot"

describe("Robot", () => {
  it("starts idle at the center of its tile", () => {
    const robot = new Robot(4, 7)
    expect(robot.pos).toEqual({ x: 4.5, y: 7.5 })
    expect(robot.isMoving).toBe(false)
    expect(robot.pathStart).toEqual({ x: 4, y: 7 })
    const w = tileToWorld(4, 7)
    expect(robot.sprite.position.x).toBe(w.x)
    expect(robot.sprite.position.y).toBe(w.y)
    expect(robot.sprite.zIndex).toBe(12)
  })

  it("moves along its path at 3 tiles per second", () => {
    const robot = new Robot(0, 0)
    robot.setPath([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
    ])
    expect(robot.isMoving).toBe(true)

    robot.update(0.25) // 0.75 tiles
    expect(robot.pos.x).toBeCloseTo(1.25)
    expect(robot.pos.y).toBeCloseTo(0.5)
    // Heading into tile (1,0), so new paths start from there.
    expect(robot.pathStart).toEqual({ x: 1, y: 0 })

    const w = gridToWorld(robot.pos.x, robot.pos.y)
    expect(robot.sprite.position.x).toBeCloseTo(w.x)
    expect(robot.sprite.zIndex).toBeCloseTo(1.75)
  })

  it("stops exactly on the last tile", () => {
    const robot = new Robot(0, 0)
    robot.setPath([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
    ])
    robot.update(10)
    expect(robot.pos).toEqual({ x: 2.5, y: 0.5 })
    expect(robot.isMoving).toBe(false)
    expect(robot.pathStart).toEqual({ x: 2, y: 0 })
  })

  it("faces the direction it moves on screen", () => {
    const robot = new Robot(5, 5)
    expect(robot.sprite.scale.x).toBe(1)

    robot.setPath([{ x: 4, y: 5 }]) // −gx → screen-left
    robot.update(0.1)
    expect(robot.sprite.scale.x).toBe(-1)

    robot.setPath([{ x: 5, y: 4 }]) // −gy → screen-right
    robot.update(1)
    expect(robot.sprite.scale.x).toBe(1)
  })

  it("keeps its facing when moving straight up or down the screen", () => {
    const robot = new Robot(5, 5)
    robot.setPath([{ x: 4, y: 5 }])
    robot.update(1)
    expect(robot.sprite.scale.x).toBe(-1)

    robot.setPath([{ x: 5, y: 6 }]) // +gx +gy → straight down
    robot.update(1)
    expect(robot.sprite.scale.x).toBe(-1)
    expect(robot.pos).toEqual({ x: 5.5, y: 6.5 })
  })
})
