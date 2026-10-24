import { Container, Graphics, Sprite, Texture } from "pixi.js"
import { describe, expect, it, vi } from "vitest"
import { ICE_VARIANTS } from "./assets"
import {
  ARMY_MAN_MARCH,
  ROBOT_ARRIVE,
  TERRAFORM_SOUNDS,
} from "./constants/sounds"
import { BLOCKED_COLOR, GOAL_COLOR, HOVER_COLOR } from "./constants/color"
import {
  buildBuildings,
  buildGround,
  groundAsset,
  drawTileOutline,
  footprintOrigin,
  Game,
  makeBuildingSprite,
  MARCH_BEAT,
  MAX_SPACEMEN_PER_STATION,
} from "./game"
import {
  gridToWorld,
  gridToZIndex,
  Point,
  tileCornersWorld,
  tileToWorld,
} from "./iso"
import { BUILDABLE_TERRAIN, footprint, TileMap } from "./map"
import { ROBOT_KINDS } from "./robot"
import { AudioSettings } from "./audioSettings"
import { SoundPlayer, sound as sharedSound } from "./sound"
import { Spaceman } from "./spaceman"
import { TERRAFORM_EFFECTS } from "./terraformEffects"
import { TERRAIN_EFFECTS } from "./tileEffects"
import { TERRAFORMABLE } from "./tools"

const VIEWPORT = { width: 800, height: 600 }

function newGame(random?: () => number): Game {
  return new Game({ mapSize: 32, seed: 1337, viewport: VIEWPORT, random })
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

  it("gives each ice tile a fixed crack pattern from its position", () => {
    const map = new TileMap(16, 16)
    for (const t of map.tiles) t.terrain = "ice"
    const looks = map.tiles.map((_, i) => groundAsset(map, i % 16, i >> 4))
    expect(new Set(looks)).toEqual(new Set(ICE_VARIANTS))
    expect(groundAsset(map, 3, 5)).toBe(groundAsset(map, 3, 5))
    map.getTile(3, 5).terrain = "rocky"
    expect(groundAsset(map, 3, 5)).toBe("rocky")
    expect((buildGround(map).children[5 * 16 + 3] as Sprite).label).toBe(
      "rocky",
    )
  })

  it("buildBuildings adds depth-sorted sprites only where buildings are", () => {
    const map = new TileMap(3, 3)
    map.place("habitat", 2, 1)
    const into = new Container()
    buildBuildings(map, into)
    expect(into.children).toHaveLength(1)
    const sprite = into.children[0]
    expect(sprite.position.x).toBe(tileToWorld(2, 1).x)
    expect(sprite.zIndex).toBe(gridToZIndex(2.5, 1.5))
  })

  it("makeBuildingSprite stands a building on a tile", () => {
    const sprite = makeBuildingSprite("habitat", { x: 4, y: 1 })
    expect(sprite.position.x).toBe(tileToWorld(4, 1).x)
    expect(sprite.position.y).toBe(tileToWorld(4, 1).y)
    expect(sprite.zIndex).toBe(gridToZIndex(4.5, 1.5))
  })

  it("makeBuildingSprite stands a radar on its 2×2 footprint center", () => {
    const sprite = makeBuildingSprite("radar", { x: 4, y: 1 })
    expect(sprite.position.x).toBe(gridToWorld(5, 2).x)
    expect(sprite.position.y).toBe(gridToWorld(5, 2).y)
    expect(sprite.zIndex).toBe(gridToZIndex(5, 2))
  })

  it("footprintOrigin centers the footprint on the cursor", () => {
    expect(footprintOrigin("habitat", { x: 3.9, y: 4.1 })).toEqual({
      x: 3,
      y: 4,
    })
    // 2×2: the nearest tile corner becomes the footprint's center.
    expect(footprintOrigin("radar", { x: 3.9, y: 4.1 })).toEqual({
      x: 3,
      y: 3,
    })
    expect(footprintOrigin("radar", { x: 3.4, y: 4.6 })).toEqual({
      x: 2,
      y: 4,
    })
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
  it("builds the world with the yellow robot centered on screen", () => {
    const game = newGame()
    const [ground, effects, overlay, ring, objects, airEffects] =
      game.camera.world.children
    expect(ground.children).toHaveLength(32 * 32)
    expect(effects).toBe(game.tileEffects.view)
    expect(airEffects).toBe(game.tileEffects.airView)
    expect(overlay).toBe(game.overlay)
    expect(ring).toBe(game.selectionRing)
    expect(objects).toBe(game.objects)
    expect(game.objects.sortableChildren).toBe(true)
    // 14 habitats + 2 robots.
    expect(game.objects.children).toHaveLength(16)
    expect(game.robots.map((r) => r.kind)).toEqual(ROBOT_KINDS)
    expect(game.robots.map((r) => r.pathStart)).toEqual([
      { x: 16, y: 16 },
      { x: 17, y: 16 },
    ])
    for (const r of game.robots) {
      expect(game.objects.children).toContain(r.sprite)
    }
    expect(game.selRobot).toBe(game.robots[0])
    expect(getScreenPos(game, 16, 16)).toEqual({ x: 400, y: 300 })
  })

  describe("prepared maps", () => {
    it("uses a given map and centers robots on it", () => {
      const map = new TileMap(7, 5)
      map.place("habitat", 0, 0)
      const game = new Game({ map, viewport: VIEWPORT })
      expect(game.map).toBe(map)
      // One habitat + 2 robots.
      expect(game.objects.children).toHaveLength(3)
      expect(game.robots.map((r) => r.tile)).toEqual([
        { x: 3, y: 2 },
        { x: 4, y: 2 },
      ])
      expect(getScreenPos(game, 3, 2)).toEqual({ x: 400, y: 300 })
    })

    it("places robots on given start tiles", () => {
      const game = new Game({
        map: new TileMap(6, 6),
        robotTiles: [
          { x: 1, y: 4 },
          { x: 5, y: 0 },
        ],
        viewport: VIEWPORT,
      })
      expect(game.robots.map((r) => r.tile)).toEqual([
        { x: 1, y: 4 },
        { x: 5, y: 0 },
      ])
    })

    it("moveRobot sends any robot along a path, if one exists", () => {
      const map = new TileMap(6, 6)
      map.place("habitat", 5, 5)
      const game = new Game({ map, viewport: VIEWPORT })
      const blue = game.robots[1]
      expect(game.moveRobot(blue, { x: 0, y: 0 })).toBe(true)
      expect(blue.goal).toEqual({ x: 0, y: 0 })
      expect(blue.isMoving).toBe(true)
      expect(game.moveRobot(blue, { x: 5, y: 5 })).toBe(false)
      expect(game.moveRobot(blue, { x: 9, y: 9 })).toBe(false)
      expect(blue.goal).toEqual({ x: 0, y: 0 })
    })
  })

  describe("robot selection", () => {
    /** Center of robot button `i` on the dashboard. */
    function robotButton(game: Game, i: number): Point {
      const { x, y } = game.dashboard.robots.view
      return { x: x + 8 + i * 64 + 28, y: y + 8 + 28 }
    }

    /** The selection ring's last stroke style. */
    function ringStroke(game: Game) {
      const stroke = vi.spyOn(game.selectionRing, "stroke")
      const ellipse = vi.spyOn(game.selectionRing, "ellipse")
      game.update(0)
      const style = stroke.mock.lastCall![0] as { color: number }
      const [x, y] = ellipse.mock.lastCall!
      stroke.mockRestore()
      ellipse.mockRestore()
      return { color: style.color, x, y }
    }

    it("clicking a robot button switches which robot moves", () => {
      const game = newGame()
      const [yellow, blue] = game.robots
      click(game, robotButton(game, 1))
      expect(game.selRobot).toBe(blue)

      click(game, getScreenPos(game, 20, 18))
      expect(blue.goal).toEqual({ x: 20, y: 18 })
      expect(game.goalTile).toEqual({ x: 20, y: 18 })
      expect(yellow.isMoving).toBe(false)
      expect(yellow.goal).toBeNull()
    })

    it("hotkeys select robots, and each keeps its own goal", () => {
      const game = newGame()
      const [yellow, blue] = game.robots
      click(game, getScreenPos(game, 20, 16))
      game.keyDown("w")
      click(game, getScreenPos(game, 12, 16))
      expect(yellow.goal).toEqual({ x: 20, y: 16 })
      expect(blue.goal).toEqual({ x: 12, y: 16 })
      // Both goals are outlined while both robots travel.
      expect(strokeColors(game, 0.01)).toEqual([GOAL_COLOR, GOAL_COLOR])

      game.update(10)
      expect(yellow.pos).toEqual({ x: 20.5, y: 16.5 })
      expect(blue.pos).toEqual({ x: 12.5, y: 16.5 })
      expect(yellow.goal).toBeNull()
      expect(blue.goal).toBeNull()

      game.keyDown("q")
      expect(game.selRobot).toBe(yellow)
    })

    it("rings the selected robot in its color", () => {
      const game = newGame()
      const [yellow, blue] = game.robots
      expect(ringStroke(game)).toEqual({
        color: ROBOT_KINDS[0].color,
        x: yellow.sprite.x,
        y: yellow.sprite.y,
      })
      game.keyDown("w")
      expect(ringStroke(game)).toEqual({
        color: ROBOT_KINDS[1].color,
        x: blue.sprite.x,
        y: blue.sprite.y,
      })
    })

    it("re-plans every robot's route around a new building", () => {
      const game = newGame()
      const [yellow, blue] = game.robots
      click(game, getScreenPos(game, 22, 16))
      game.keyDown("w")
      click(game, getScreenPos(game, 12, 16))
      const yellowPath = vi.spyOn(yellow, "setPath")
      const bluePath = vi.spyOn(blue, "setPath")
      game.build("habitat", { x: 20, y: 25 })
      expect(yellowPath).toHaveBeenCalledOnce()
      expect(bluePath).toHaveBeenCalledOnce()
    })

    it("won't build on the unselected robot either", () => {
      const game = newGame()
      expect(game.canBuild("habitat", game.robots[1].tile)).toBe(false)
    })
  })

  it("clicking an open tile sends the robot there", () => {
    const game = newGame()
    click(game, getScreenPos(game, 20, 16))
    expect(game.goalTile).toEqual({ x: 20, y: 16 })
    expect(game.selRobot.isMoving).toBe(true)

    game.update(10)
    expect(game.selRobot.pos).toEqual({ x: 20.5, y: 16.5 })
    expect(game.goalTile).toBeNull()
  })

  it("ignores clicks on buildings and outside the map", () => {
    const game = newGame()
    const built = findBuilding(game)
    click(game, getScreenPos(game, built.x, built.y))
    click(game, getScreenPos(game, -5, -5))
    expect(game.goalTile).toBeNull()
    expect(game.selRobot.isMoving).toBe(false)
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

  it("plays tile effects as time passes", () => {
    const game = newGame(() => 0.5)
    game.update(5)
    expect(game.tileEffects.active.length).toBeGreaterThan(0)
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

    it("routes window key presses to the build menu", () => {
      const { game } = bound()
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "1" }))
      expect(game.dashboard.build.selected).toBe("habitat")
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }))
      expect(game.dashboard.build.selected).toBeNull()
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

  describe("build mode", () => {
    /** First tile in row 16 east of the robot that can be built on. */
    function buildableTile(game: Game): Point {
      for (let x = 18; x < game.map.width; x++) {
        if (game.canBuild("habitat", { x, y: 16 })) return { x, y: 16 }
      }
      throw new Error("no buildable tile")
    }

    function findTerrain(game: Game, buildable: boolean): Point {
      const i = game.map.tiles.findIndex(
        (t) => !t.building && BUILDABLE_TERRAIN.has(t.terrain) === buildable,
      )
      return { x: i % game.map.width, y: Math.floor(i / game.map.width) }
    }

    /** Center of the first build button. */
    function menuButton(game: Game): Point {
      const { x, y } = game.dashboard.build.view
      return { x: x + 8 + 28, y: y + 8 + 28 }
    }

    it("lays out the dashboard for the viewport and on resize", () => {
      const game = newGame()
      const bar = game.dashboard.build
      expect(bar.view.y).toBe(VIEWPORT.height - bar.height - 16)
      game.resize(1000, 700)
      expect(bar.view.y).toBe(700 - bar.height - 16)
    })

    it("canBuild rejects buildings, bad terrain, and the robot's tiles", () => {
      const game = newGame()
      const open = buildableTile(game)
      expect(game.canBuild("habitat", open)).toBe(true)
      expect(game.canBuild("habitat", findBuilding(game))).toBe(false)
      expect(game.canBuild("habitat", findTerrain(game, false))).toBe(false)
      expect(game.canBuild("habitat", { x: -1, y: 0 })).toBe(false)
      expect(game.canBuild("habitat", { x: 16, y: 16 })).toBe(false)
      // Any footprint tile over the robot blocks a radar.
      expect(game.canBuild("radar", { x: 15, y: 15 })).toBe(false)

      // While moving, the tile the robot is heading into is reserved too.
      click(game, getScreenPos(game, open.x, open.y))
      game.update(0.01)
      expect(game.selRobot.pathStart).not.toEqual({ x: 16, y: 16 })
      expect(game.canBuild("habitat", game.selRobot.pathStart)).toBe(false)
    })

    it("clicking a menu button selects it instead of moving the robot", () => {
      const game = newGame()
      click(game, menuButton(game))
      expect(game.dashboard.build.selected).toBe("habitat")
      expect(game.selRobot.isMoving).toBe(false)
    })

    it("dragging from the menu neither pans nor clicks", () => {
      const game = newGame()
      const b = menuButton(game)
      game.pointerDown(b.x, b.y)
      game.pointerMove(b.x - 100, b.y - 100)
      game.pointerUp(b.x - 100, b.y - 100)
      expect(getScreenPos(game, 16, 16)).toEqual({ x: 400, y: 300 })
      expect(game.dashboard.build.selected).toBeNull()
      expect(game.goalTile).toBeNull()
    })

    it("hovering the menu clears the hover tile", () => {
      const game = newGame()
      const b = menuButton(game)
      // The map extends under the menu, so only the menu check hides it.
      const under = game.camera.screenToTile(b.x, b.y)
      expect(game.map.isInBounds(under.x, under.y)).toBe(true)
      game.pointerMove(b.x, b.y)
      expect(game.hoverTile).toBeNull()
    })

    it("clicking the map places the selected building", () => {
      const game = newGame()
      const tile = buildableTile(game)
      const count = game.objects.children.length
      game.dashboard.build.select("habitat")
      click(game, getScreenPos(game, tile.x, tile.y))
      expect(game.map.getTile(tile.x, tile.y).building?.type).toBe("habitat")
      expect(game.objects.children).toHaveLength(count + 1)
      expect(game.selRobot.isMoving).toBe(false)
      // Stays in build mode for placing more.
      expect(game.dashboard.build.selected).toBe("habitat")

      // Can't build there again.
      expect(game.build("habitat", tile)).toBe(false)
      expect(game.objects.children).toHaveLength(count + 1)
    })

    it("re-plans the robot's route around a new building", () => {
      const game = newGame()
      const goal = { x: 22, y: 16 }
      click(game, getScreenPos(game, goal.x, goal.y))
      const setPath = vi.spyOn(game.selRobot, "setPath")
      const tile = buildableTile(game)
      expect(game.build("habitat", tile)).toBe(true)
      expect(setPath).toHaveBeenCalledOnce()
      game.update(10)
      expect(game.selRobot.pos).toEqual({ x: goal.x + 0.5, y: goal.y + 0.5 })
    })

    it("stops the robot if its goal gets built on", () => {
      const game = newGame()
      const goal = buildableTile(game)
      click(game, getScreenPos(game, goal.x, goal.y))
      game.update(0.01)
      const next = game.selRobot.pathStart
      expect(game.build("habitat", goal)).toBe(true)
      expect(game.goalTile).toBeNull()
      game.update(10)
      expect(game.selRobot.pos).toEqual({ x: next.x + 0.5, y: next.y + 0.5 })
    })

    it("shows a ghost preview, tinted when the tile is blocked", () => {
      const game = newGame()
      const open = getScreenPos(game, buildableTile(game).x, 16)
      game.pointerMove(open.x, open.y)
      game.update(0)
      expect(game.ghost).toBeNull()

      game.keyDown("1")
      expect(strokeColors(game, 0)).toEqual([HOVER_COLOR])
      const ghost = game.ghost!
      expect(game.objects.children).toContain(ghost)
      expect(ghost.alpha).toBe(0.6)
      expect(ghost.tint).toBe(0xffffff)

      const built = findBuilding(game)
      const b = getScreenPos(game, built.x, built.y)
      game.pointerMove(b.x, b.y)
      expect(strokeColors(game, 0)).toEqual([BLOCKED_COLOR])
      expect(game.ghost).toBe(ghost)
      expect(ghost.position.x).toBe(tileToWorld(built.x, built.y).x)
      expect(ghost.tint).toBe(BLOCKED_COLOR)

      game.keyDown("Escape")
      game.update(0)
      expect(game.ghost).toBeNull()
      expect(game.objects.children).not.toContain(ghost)
    })

    /** Origin of a buildable 2×2 spot near the robot. */
    function radarSpot(game: Game): Point {
      for (let y = 10; y < 22; y++) {
        for (let x = 10; x < 22; x++) {
          if (game.canBuild("radar", { x, y })) return { x, y }
        }
      }
      throw new Error("no radar spot")
    }

    it("places a radar station across a 2×2 footprint", () => {
      const game = newGame()
      const origin = radarSpot(game)
      game.keyDown("2")
      // Cursor on the corner shared by the footprint's four tiles.
      const p = game.camera.worldToScreen(
        gridToWorld(origin.x + 1, origin.y + 1).x,
        gridToWorld(origin.x + 1, origin.y + 1).y,
      )
      game.pointerMove(p.x + 0.5, p.y)
      expect(strokeColors(game, 0)).toEqual(Array(4).fill(HOVER_COLOR))
      expect(game.ghost!.position.x).toBeCloseTo(
        gridToWorld(origin.x + 1, origin.y + 1).x,
      )
      click(game, { x: p.x + 0.5, y: p.y })
      const radar = game.map.getTile(origin.x, origin.y).building!
      expect(radar).toEqual({ type: "radar", ...origin })
      for (const t of footprint("radar", origin.x, origin.y)) {
        expect(game.map.getTile(t.x, t.y).building).toBe(radar)
      }
      // Overlapping it now shows all four tiles blocked.
      expect(strokeColors(game, 0)).toEqual(Array(4).fill(BLOCKED_COLOR))
    })

    it("swaps the ghost when the selection changes", () => {
      const game = newGame()
      const p = getScreenPos(game, buildableTile(game).x, 16)
      game.pointerMove(p.x, p.y)
      game.keyDown("1")
      game.update(0)
      const habitatGhost = game.ghost!
      game.keyDown("2")
      game.update(0)
      expect(game.ghost).not.toBe(habitatGhost)
      expect(habitatGhost.destroyed).toBe(true)
      expect(game.ghost!.label).toBe("radar")
    })
  })

  describe("radar crew", () => {
    /** Deterministic stand-in for Math.random cycling through values. */
    function cycle(...values: number[]): () => number {
      let i = 0
      return () => values[i++ % values.length]
    }

    function withRadar(random = cycle(0.5)) {
      const game = newGame(random)
      for (let y = 10; y < 22; y++) {
        for (let x = 18; x < 22; x++) {
          if (game.build("radar", { x, y })) {
            return { game, radar: game.map.getTile(x, y).building! }
          }
        }
      }
      throw new Error("no radar spot")
    }

    it("spawns spacemen at a door, up to a cap per station", () => {
      const { game, radar } = withRadar()
      game.update(0.01)
      expect(game.spacemen).toHaveLength(1)
      const first = game.spacemen[0]
      expect(first.station).toBe(radar)
      expect(game.objects.children).toContain(first.sprite)
      const doors = game.map.doorsOf(radar)
      expect(doors).toContainEqual({
        x: Math.floor(first.pos.x),
        y: Math.floor(first.pos.y),
      })

      // Waits SPAWN_MIN + 0.5 × SPAWN_RANGE = 6.5s between spawns.
      game.update(6)
      expect(game.spacemen).toHaveLength(1)
      game.update(0.6)
      expect(game.spacemen).toHaveLength(2)
      for (let i = 0; i < 4; i++) game.update(6.5)
      expect(game.spacemen).toHaveLength(MAX_SPACEMEN_PER_STATION)
    })

    it("removes spacemen once they're back home", () => {
      const { game } = withRadar()
      game.update(0.01)
      const spaceman = game.spacemen[0]
      spaceman.state = "home"
      game.update(0.01)
      expect(game.spacemen).not.toContain(spaceman)
      expect(spaceman.sprite.destroyed).toBe(true)
    })

    it("doesn't spawn from a station with no open doors", () => {
      const game = newGame(cycle(0.5))
      const radar = game.map.place("radar", 0, 0)
      for (const d of game.map.doorsOf(radar))
        game.map.place("habitat", d.x, d.y)
      game.update(0.01)
      expect(game.spacemen).toHaveLength(0)
    })

    it("won't build on spacemen and re-routes those it cuts off", () => {
      // Varied values so the wander target lands away from the station.
      const { game } = withRadar(cycle(0.5, 0.95, 0.95))
      game.update(0.01)
      const spaceman = game.spacemen[0]
      expect(game.canBuild("habitat", spaceman.tile)).toBe(false)

      // Let them pick a route, then build on a tile further along it.
      game.update(0.01)
      const route = spaceman.remainingPath
      // Building off the route leaves it alone.
      const far = Array.from({ length: 32 }, (_, x) => ({ x, y: 0 })).find(
        (t) => game.canBuild("habitat", t),
      )!
      game.build("habitat", far)
      expect(spaceman.remainingPath).toBe(route)
      const ahead = route.slice(1).find((t) => game.canBuild("habitat", t))!
      expect(ahead).toBeDefined()
      game.build("habitat", ahead)
      expect(spaceman.remainingPath).toEqual([spaceman.pathStart])
    })
  })

  describe("tools", () => {
    /** Center of tool button `i` on the dashboard. */
    function toolButton(game: Game, i: number): Point {
      const { x, y } = game.dashboard.tools.view
      return { x: x + 8 + i * 64 + 28, y: y + 8 + 28 }
    }

    /** Nearest tile to the center that terraforming would change. */
    function roughTile(game: Game): Point {
      let best: Point | null = null
      let bestDist = Infinity
      game.map.tiles.forEach((t, i) => {
        if (t.building || !TERRAFORMABLE.has(t.terrain)) return
        const p = { x: i % 32, y: Math.floor(i / 32) }
        const d = Math.hypot(p.x - 16, p.y - 16)
        if (d < bestDist) [best, bestDist] = [p, d]
      })
      return best!
    }

    function groundSprite(game: Game, t: Point): Sprite {
      return game.ground.children[t.y * 32 + t.x] as Sprite
    }

    it("the tool bar sets the selected robot's tool", () => {
      const game = newGame()
      const [yellow, blue] = game.robots
      click(game, toolButton(game, 0))
      expect(yellow.tool).toBe("terraform")
      expect(blue.tool).toBeNull()

      // Switching robots shows that robot's tool.
      game.keyDown("w")
      expect(game.dashboard.tools.selected).toBeNull()
      game.keyDown("q")
      expect(game.dashboard.tools.selected).toBe("terraform")

      game.keyDown("t")
      expect(yellow.tool).toBeNull()
    })

    it("a robot terraforms the tile it stops on", () => {
      const game = newGame()
      const tile = roughTile(game)
      game.keyDown("t")
      click(game, getScreenPos(game, tile.x, tile.y))
      game.update(10)
      expect(game.selRobot.tile).toEqual(tile)
      expect(game.map.getTile(tile.x, tile.y).terrain).toBe("regolith")
      const sprite = groundSprite(game, tile)
      expect(sprite.label).toBe("regolith")
      expect(sprite.texture).toBe(Texture.from("regolith"))
      // With a puff of dust.
      expect(game.tileEffects.active.map((e) => e.tile)).toContainEqual(tile)
    })

    it("does nothing without a tool, or for a robot that never moved", () => {
      const game = newGame()
      const tile = roughTile(game)
      const terrain = game.map.getTile(tile.x, tile.y).terrain
      click(game, getScreenPos(game, tile.x, tile.y))
      game.update(10)
      expect(game.map.getTile(tile.x, tile.y).terrain).toBe(terrain)

      const useTool = vi.spyOn(game, "useTool")
      game.keyDown("t")
      game.update(1)
      expect(useTool).not.toHaveBeenCalled()
    })

    it("plays a different effect for each terrain it clears", () => {
      const game = newGame()
      const play = vi.spyOn(game.tileEffects, "play")
      for (const terrain of ["crater", "rocky", "ice"] as const) {
        game.map.getTile(3, 3).terrain = terrain
        game.terraform({ x: 3, y: 3 })
        expect(play).toHaveBeenLastCalledWith(
          { x: 3, y: 3 },
          TERRAFORM_EFFECTS[terrain],
        )
      }
    })

    it("terraform only changes rough terrain", () => {
      const game = newGame()
      const t = game.map.getTile(16, 16)
      expect(t.terrain).toBe("regolith")
      expect(game.useTool("terraform", { x: 16, y: 16 })).toBe(false)
    })

    it("terraforming stops the tile's effects and recenters it", () => {
      const game = newGame(() => 0.5)
      const tile = roughTile(game)
      game.map.getTile(tile.x, tile.y).terrain = "ice"
      game.tileEffects.play(tile, TERRAIN_EFFECTS.ice!.create)
      const [shake] = game.tileEffects.active
      shake.animate(0) // shaken a pixel off-center
      const sprite = groundSprite(game, tile)
      expect(sprite.x).not.toBe(tileToWorld(tile.x, tile.y).x)

      expect(game.terraform(tile)).toBe(true)
      expect(game.tileEffects.active).not.toContain(shake)
      expect(sprite.x).toBe(tileToWorld(tile.x, tile.y).x)
      expect(sprite.y).toBe(tileToWorld(tile.x, tile.y).y)
    })
  })

  describe("sound", () => {
    function withSound() {
      const sound = new SoundPlayer(undefined, new AudioSettings(null))
      const play = vi.spyOn(sound, "playSound")
      const game = new Game({
        mapSize: 32,
        seed: 1337,
        viewport: VIEWPORT,
        sound,
      })
      return { game, sound, play }
    }

    it("uses the shared player by default", () => {
      expect(newGame().sound).toBe(sharedSound)
    })

    it("chimes when a robot arrives, not while it walks or idles", () => {
      const { game, play } = withSound()
      click(game, getScreenPos(game, 20, 16))
      game.update(0.1)
      expect(play).not.toHaveBeenCalled()
      game.update(10)
      expect(play).toHaveBeenCalledExactlyOnceWith(ROBOT_ARRIVE)
      game.update(1)
      expect(play).toHaveBeenCalledOnce()
    })

    it("plays each terrain's terraform sound", () => {
      const { game, play } = withSound()
      for (const terrain of ["crater", "rocky", "ice"] as const) {
        game.map.getTile(3, 3).terrain = terrain
        game.terraform({ x: 3, y: 3 })
        expect(play).toHaveBeenLastCalledWith(TERRAFORM_SOUNDS[terrain])
      }
    })

    it("marches while astronauts walk, on one shared beat", () => {
      const sound = new SoundPlayer(undefined, new AudioSettings(null))
      const play = vi.spyOn(sound, "playSound")
      const game = new Game({
        mapSize: 32,
        seed: 1337,
        viewport: VIEWPORT,
        sound,
        // Varied so wander targets land off the station.
        random: (() => {
          const values = [0.5, 0.95, 0.95]
          let i = 0
          return () => values[i++ % values.length]
        })(),
      })
      const stomps = () =>
        play.mock.calls.filter(([s]) => s === ARMY_MAN_MARCH).length
      const radar = game.map.place("radar", 2, 2)
      game.update(0.01) // first astronaut out
      game.update(0.01) // and walking
      expect(game.spacemen[0].isMoving).toBe(true)
      expect(stomps()).toBe(1) // straight away

      game.update(MARCH_BEAT * 0.9)
      expect(stomps()).toBe(1)
      game.update(MARCH_BEAT * 0.2)
      expect(stomps()).toBe(2)

      // A second walker doesn't double the beat.
      game.spacemen.push(new Spaceman(radar, { x: 4, y: 3 }, () => 0.9))
      game.update(MARCH_BEAT)
      expect(stomps()).toBe(3)

      // One long frame plays one stomp, not a backlog.
      game.update(MARCH_BEAT * 3)
      expect(stomps()).toBe(4)
    })

    it("stops marching when nobody walks, and restarts on the next step", () => {
      const { game, play } = withSound()
      // Not placed on the map, so it won't send out crew of its own.
      const radar = { type: "radar" as const, x: 2, y: 2 }
      const walker = new Spaceman(radar, { x: 4, y: 3 }, () => 0.5)
      // Only follow the paths we give it; no wandering of its own.
      vi.spyOn(walker, "think").mockImplementation((_, dt) => walker.update(dt))
      game.spacemen.push(walker)
      walker.setPath([
        { x: 4, y: 3 },
        { x: 5, y: 3 },
      ])
      game.update(0.01)
      expect(play).toHaveBeenLastCalledWith(ARMY_MAN_MARCH)
      walker.setPath([])
      play.mockClear()
      game.update(MARCH_BEAT * 2)
      expect(play).not.toHaveBeenCalledWith(ARMY_MAN_MARCH)

      walker.setPath([{ x: 5, y: 3 }])
      game.update(0.01)
      expect(play).toHaveBeenCalledWith(ARMY_MAN_MARCH)
    })

    it("M toggles mute", () => {
      const { game, sound } = withSound()
      game.keyDown("m")
      expect(sound.settings.muted).toBe(true)
      game.keyDown("M")
      expect(sound.settings.muted).toBe(false)
      // M isn't passed on to the dashboard.
      expect(game.dashboard.build.selected).toBeNull()
    })

    it("ignores keys typed into form controls", () => {
      const { game } = withSound()
      game.bindInput(new Container(), document.createElement("canvas"))
      const slider = document.createElement("input")
      document.body.append(slider)
      slider.dispatchEvent(
        new KeyboardEvent("keydown", { key: "1", bubbles: true }),
      )
      expect(game.dashboard.build.selected).toBeNull()
      slider.remove()
    })

    it("pauses audio while the page is hidden", () => {
      const { game, sound } = withSound()
      const setPaused = vi.spyOn(sound, "setPaused")
      game.bindInput(new Container(), document.createElement("canvas"))
      document.dispatchEvent(new Event("visibilitychange"))
      expect(setPaused).toHaveBeenCalledWith(document.hidden)
    })

    it("unlocks audio on the first click or key press", () => {
      const { game, sound } = withSound()
      const unlock = vi.spyOn(sound, "unlock").mockResolvedValue()
      game.bindInput(new Container(), document.createElement("canvas"))
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "x" }))
      expect(unlock).toHaveBeenCalledOnce()
    })
  })
})
