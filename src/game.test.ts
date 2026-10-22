import { Container, Graphics } from "pixi.js"
import { describe, expect, it, vi } from "vitest"
import { BLOCKED_COLOR, GOAL_COLOR, HOVER_COLOR } from "./constants/color"
import { buildBuildings, buildGround, drawTileOutline, Game } from "./game"
import { gridToZIndex, Point, tileCornersWorld, tileToWorld } from "./iso"
import { TileMap } from "./map"

const VIEWPORT = { width: 800, height: 600 }

function newGame(): Game {
  return new Game({ mapSize: 32, seed: 1337, viewport: VIEWPORT })
}

function getScreenPos(game: Game, tx: number, ty: number): Point {
  const w = tileToWorld(tx, ty)
  return game.camera.worldToScreen(w.x, w.y)
}

function click(game: Game, p: Point): void {
  game.pointerDown(p.x, p.y)
  game.pointerUp(p.x, p.y)
}

function findBuilding(game: Game): Point {
  const i = game.map.tiles.findIndex((t) => t.building !== null)
  return { x: i % game.map.width, y: Math.floor(i / game.map.width) }
}

/** Colors passed to overlay.stroke() during one update. */
function strokeColors(game: Game, dt: number): number[] {
  const stroke = vi.spyOn(game.overlay, "stroke")
  game.update(dt)
  const colors = stroke.mock.calls.map(
    ([style]) => (style as { color: number }).color,
  )
  stroke.mockRestore()
  return colors
}

describe("scene builders", () => {
  it("buildGround makes one positioned sprite per tile", () => {
    const map = new TileMap(3, 2)
    const ground = buildGround(map)
    expect(ground.children).toHaveLength(6)
    const last = ground.children[5]
    expect(last.position.x).toBe(tileToWorld(2, 1).x)
    expect(last.position.y).toBe(tileToWorld(2, 1).y)
  })

  it("buildBuildings adds depth-sorted sprites only where buildings are", () => {
    const map = new TileMap(3, 3)
    map.getTile(2, 1).building = "habitat"
    const into = new Container()
    buildBuildings(map, into)
    expect(into.children).toHaveLength(1)
    const sprite = into.children[0]
    expect(sprite.position.x).toBe(tileToWorld(2, 1).x)
    expect(sprite.zIndex).toBe(gridToZIndex(2.5, 1.5))
  })

  it("drawTileOutline traces the tile's diamond", () => {
    const g = new Graphics()
    const poly = vi.spyOn(g, "poly")
    const stroke = vi.spyOn(g, "stroke")
    drawTileOutline(g, { x: 3, y: 4 }, 0x123456, 0.5)
    expect(poly).toHaveBeenCalledWith(
      tileCornersWorld(3, 4).flatMap((p) => [p.x, p.y]),
    )
    expect(stroke).toHaveBeenCalledWith({
      color: 0x123456,
      alpha: 0.5,
      width: 1.5,
    })
  })
})

describe("Game", () => {
  it("builds the world with the robot centered on screen", () => {
    const game = newGame()
    const [ground, overlay, objects] = game.camera.world.children
    expect(ground.children).toHaveLength(32 * 32)
    expect(overlay).toBe(game.overlay)
    expect(objects).toBe(game.objects)
    expect(game.objects.sortableChildren).toBe(true)
    expect(game.objects.children).toContain(game.robot.sprite)
    // 14 habitats + the robot.
    expect(game.objects.children).toHaveLength(15)
    expect(game.robot.pathStart).toEqual({ x: 16, y: 16 })
    expect(getScreenPos(game, 16, 16)).toEqual({ x: 400, y: 300 })
  })

  it("clicking an open tile sends the robot there", () => {
    const game = newGame()
    click(game, getScreenPos(game, 20, 16))
    expect(game.goalTile).toEqual({ x: 20, y: 16 })
    expect(game.robot.isMoving).toBe(true)

    game.update(10)
    expect(game.robot.pos).toEqual({ x: 20.5, y: 16.5 })
    expect(game.goalTile).toBeNull()
  })

  it("ignores clicks on buildings and outside the map", () => {
    const game = newGame()
    const built = findBuilding(game)
    click(game, getScreenPos(game, built.x, built.y))
    click(game, getScreenPos(game, -5, -5))
    expect(game.goalTile).toBeNull()
    expect(game.robot.isMoving).toBe(false)
  })

  it("small pointer jitter still counts as a click", () => {
    const game = newGame()
    const p = getScreenPos(game, 18, 16)
    game.pointerDown(p.x, p.y)
    game.pointerMove(p.x + 2, p.y + 2)
    game.pointerUp(p.x + 2, p.y + 2)
    expect(game.goalTile).toEqual({ x: 18, y: 16 })
  })

  it("dragging pans the camera instead of clicking", () => {
    const game = newGame()
    const p = getScreenPos(game, 18, 16)
    game.pointerDown(p.x, p.y)
    game.pointerMove(p.x + 20, p.y + 10)
    game.pointerMove(p.x + 21, p.y + 10) // keeps panning below threshold
    game.pointerUp(p.x + 21, p.y + 10)
    expect(game.goalTile).toBeNull()
    expect(getScreenPos(game, 16, 16)).toEqual({ x: 421, y: 310 })
  })

  it("moving without a press only updates the hover tile", () => {
    const game = newGame()
    const p = getScreenPos(game, 3, 9)
    game.pointerMove(p.x, p.y)
    expect(game.hoverTile).toEqual({ x: 3, y: 9 })
    expect(getScreenPos(game, 16, 16)).toEqual({ x: 400, y: 300 })

    const off = getScreenPos(game, 40, 40)
    game.pointerMove(off.x, off.y)
    expect(game.hoverTile).toBeNull()
  })

  it("cancelPress abandons a press without moving the robot", () => {
    const game = newGame()
    const p = getScreenPos(game, 18, 16)
    game.pointerDown(p.x, p.y)
    game.cancelPress()
    game.pointerUp(p.x, p.y)
    expect(game.goalTile).toBeNull()
  })

  it("wheel zooms around the cursor", () => {
    const game = newGame()
    game.wheel(-500, 400, 300)
    expect(game.camera.zoom).toBeCloseTo(Math.exp(0.5))
    const center = getScreenPos(game, 16, 16)
    expect(center.x).toBeCloseTo(400)
    expect(center.y).toBeCloseTo(300)
  })

  it("draws hover and goal highlights each frame", () => {
    const game = newGame()
    expect(strokeColors(game, 0)).toEqual([])

    const open = getScreenPos(game, 20, 16)
    game.pointerMove(open.x, open.y)
    expect(strokeColors(game, 0)).toEqual([HOVER_COLOR])

    click(game, open)
    expect(strokeColors(game, 0.01)).toEqual([GOAL_COLOR, HOVER_COLOR])

    const built = findBuilding(game)
    const b = getScreenPos(game, built.x, built.y)
    game.pointerMove(b.x, b.y)
    expect(strokeColors(game, 0.01)).toEqual([GOAL_COLOR, BLOCKED_COLOR])
  })

  describe("bindInput", () => {
    function bound() {
      const game = newGame()
      const stage = new Container()
      const canvas = document.createElement("canvas")
      game.bindInput(stage, canvas)
      const emit = (type: string, p: Point = { x: 0, y: 0 }) =>
        stage.emit(type as "pointerdown", { global: p } as never)
      return { game, stage, canvas, emit }
    }

    it("makes the stage interactive", () => {
      expect(bound().stage.eventMode).toBe("static")
    })

    it("routes pointer events to the game", () => {
      const { game, emit } = bound()
      const p = getScreenPos(game, 18, 16)
      emit("globalpointermove", p)
      expect(game.hoverTile).toEqual({ x: 18, y: 16 })
      emit("pointerdown", p)
      emit("pointerup", p)
      expect(game.goalTile).toEqual({ x: 18, y: 16 })
    })

    it("pointerupoutside cancels the press", () => {
      const { game, emit } = bound()
      const p = getScreenPos(game, 18, 16)
      emit("pointerdown", p)
      emit("pointerupoutside")
      emit("pointerup", p)
      expect(game.goalTile).toBeNull()
    })

    it("routes canvas wheel events to zoom and blocks page scroll", () => {
      const { game, canvas } = bound()
      const wheel = vi.spyOn(game, "wheel")
      const event = new WheelEvent("wheel", { deltaY: 120, cancelable: true })
      canvas.dispatchEvent(event)
      expect(event.defaultPrevented).toBe(true)
      expect(wheel).toHaveBeenCalledWith(120, event.offsetX, event.offsetY)
    })
  })
})
