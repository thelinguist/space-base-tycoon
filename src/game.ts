import { Container, FederatedPointerEvent, Graphics } from "pixi.js"
import { makeSprite } from "./assets"
import { Camera } from "./camera"
import { BLOCKED_COLOR, GOAL_COLOR, HOVER_COLOR } from "./constants/color"
import {
  gridToZIndex,
  Point,
  tileCenter,
  tileCornersWorld,
  tileToWorld,
} from "./iso"
import { generateMap, TileMap } from "./map"
import { findPath } from "./pathfinding"
import { Robot } from "./robot"

/** Pointer movement (px) beyond which a press becomes a pan, not a click. */
export const DRAG_THRESHOLD = 5

export function buildGround(map: TileMap): Container {
  const ground = new Container()
  for (let ty = 0; ty < map.height; ty++) {
    for (let tx = 0; tx < map.width; tx++) {
      const sprite = makeSprite(map.getTile(tx, ty).terrain)
      const w = tileToWorld(tx, ty)
      sprite.position.set(w.x, w.y)
      ground.addChild(sprite)
    }
  }
  return ground
}

export function buildBuildings(map: TileMap, into: Container): void {
  for (let ty = 0; ty < map.height; ty++) {
    for (let tx = 0; tx < map.width; tx++) {
      const building = map.getTile(tx, ty).building
      if (!building) continue
      const sprite = makeSprite(building)
      const w = tileToWorld(tx, ty)
      const c = tileCenter(tx, ty)
      sprite.position.set(w.x, w.y)
      sprite.zIndex = gridToZIndex(c.x, c.y)
      into.addChild(sprite)
    }
  }
}

export function drawTileOutline(
  g: Graphics,
  tile: Point,
  color: number,
  alpha = 1.0,
): void {
  const pts = tileCornersWorld(tile.x, tile.y).flatMap((p) => [p.x, p.y])
  g.poly(pts)
    .fill({ color, alpha: alpha * 0.3 })
    .stroke({ color, alpha, width: 1.5 })
}

export interface GameOptions {
  mapSize: number
  seed: number
  /** Viewport size in screen pixels, used to center the camera. */
  viewport: { width: number; height: number }
}

/** The scene and its input handling, independent of the Pixi Application. */
export class Game {
  readonly map: TileMap
  readonly camera = new Camera()
  readonly robot: Robot
  /** Tile highlights, drawn between the ground and objects. */
  readonly overlay = new Graphics()
  /** Buildings and units, depth-sorted. */
  readonly objects = new Container()

  hoverTile: Point | null = null
  goalTile: Point | null = null
  private press: { x: number; y: number; dragging: boolean } | null = null

  constructor({ mapSize, seed, viewport }: GameOptions) {
    const center = { x: mapSize / 2, y: mapSize / 2 }
    this.map = generateMap(mapSize, mapSize, seed, center)

    this.objects.sortableChildren = true
    this.camera.world.addChild(
      buildGround(this.map),
      this.overlay,
      this.objects,
    )
    buildBuildings(this.map, this.objects)

    this.robot = new Robot(center.x, center.y)
    this.objects.addChild(this.robot.sprite)

    const start = tileToWorld(center.x, center.y)
    this.camera.lookAt(
      start.x,
      start.y,
      viewport.width / 2,
      viewport.height / 2,
    )
  }

  pointerDown(sx: number, sy: number): void {
    this.press = { x: sx, y: sy, dragging: false }
  }

  pointerMove(sx: number, sy: number): void {
    const press = this.press
    if (press) {
      const dx = sx - press.x
      const dy = sy - press.y
      if (press.dragging || Math.hypot(dx, dy) > DRAG_THRESHOLD) {
        press.dragging = true
        this.camera.panBy(dx, dy)
        press.x = sx
        press.y = sy
      }
    }
    const t = this.camera.screenToTile(sx, sy)
    this.hoverTile = this.map.isInBounds(t.x, t.y) ? t : null
  }

  /** Ends a press; if it wasn't a drag, sends the robot to the clicked tile. */
  pointerUp(sx: number, sy: number): void {
    if (this.press && !this.press.dragging) {
      const t = this.camera.screenToTile(sx, sy)
      const path = this.map.isInBounds(t.x, t.y)
        ? findPath(this.map, this.robot.pathStart, t)
        : null
      if (path) {
        this.robot.setPath(path)
        this.goalTile = t
      }
    }
    this.press = null
  }

  cancelPress(): void {
    this.press = null
  }

  wheel(deltaY: number, sx: number, sy: number): void {
    this.camera.zoomAt(Math.exp(-deltaY * 0.001), sx, sy)
  }

  update(deltaSeconds: number): void {
    this.robot.update(deltaSeconds)
    if (!this.robot.isMoving) this.goalTile = null

    this.overlay.clear()
    if (this.goalTile) {
      drawTileOutline(this.overlay, this.goalTile, GOAL_COLOR, 0.9)
    }
    if (this.hoverTile) {
      const { x, y } = this.hoverTile
      const color = this.map.isWalkable(x, y) ? HOVER_COLOR : BLOCKED_COLOR
      drawTileOutline(this.overlay, this.hoverTile, color, 0.8)
    }
  }

  /** Route Pixi stage pointer events and canvas wheel events to the game. */
  bindInput(stage: Container, canvas: HTMLElement): void {
    stage.eventMode = "static"
    stage.on("pointerdown", (e: FederatedPointerEvent) =>
      this.pointerDown(e.global.x, e.global.y),
    )
    stage.on("globalpointermove", (e: FederatedPointerEvent) =>
      this.pointerMove(e.global.x, e.global.y),
    )
    stage.on("pointerup", (e: FederatedPointerEvent) =>
      this.pointerUp(e.global.x, e.global.y),
    )
    stage.on("pointerupoutside", () => this.cancelPress())
    canvas.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault()
        this.wheel(e.deltaY, e.offsetX, e.offsetY)
      },
      { passive: false },
    )
  }
}
