import {
  Container,
  FederatedPointerEvent,
  Graphics,
  Sprite,
  Texture,
} from "pixi.js"
import { AssetName, BuildingType, ICE_VARIANTS, makeSprite } from "./assets"
import { Camera } from "./camera"
import { BLOCKED_COLOR, GOAL_COLOR, HOVER_COLOR } from "./constants/color"
import {
  gridToWorld,
  gridToZIndex,
  Point,
  tileCornersWorld,
  tileToWorld,
} from "./iso"
import {
  Building,
  BUILDING_SIZE,
  footprint,
  footprintCenter,
  generateMap,
  TileMap,
} from "./map"
import { findPath } from "./pathfinding"
import { Robot, ROBOT_KINDS } from "./robot"
import { Spaceman } from "./spaceman"
import { TERRAFORM_EFFECTS } from "./terraformEffects"
import { TileEffects } from "./tileEffects"
import { TerraformableTerrain, TERRAFORMABLE, ToolType } from "./tools"
import { hash } from "./utils/noise"
import { Dashboard } from "./ui/dashboard"

/** Pointer movement (px) beyond which a press becomes a pan, not a click. */
export const DRAG_THRESHOLD = 5

/** Opacity of the placement preview shown under the cursor in build mode. */
const GHOST_ALPHA = 0.6

/** Horizontal radius, in world pixels, of the selected robot's ring. */
const SELECTION_RING_RADIUS = 14

/** Most spacemen a single radar station has out at once. */
export const MAX_SPACEMEN_PER_STATION = 3
/** Seconds between spawn attempts at a station: MIN + random × RANGE. */
const SPAWN_MIN = 3
const SPAWN_RANGE = 7

/**
 * Footprint origin for a building of `type` centered as closely as
 * possible on a continuous grid position (the cursor). For 1×1 buildings
 * this is simply the tile under the cursor.
 */
export function footprintOrigin(type: BuildingType, grid: Point): Point {
  const half = BUILDING_SIZE[type] / 2
  return { x: Math.round(grid.x - half), y: Math.round(grid.y - half) }
}

/** Seed for picking each ice tile's starting crack pattern. */
const ICE_VARIANT_SEED = 7

/** The sprite for a tile's terrain; ice gets a per-tile crack pattern. */
export function groundAsset(map: TileMap, tx: number, ty: number): AssetName {
  const terrain = map.getTile(tx, ty).terrain
  if (terrain !== "ice") return terrain
  const i = Math.floor(hash(tx, ty, ICE_VARIANT_SEED) * ICE_VARIANTS.length)
  return ICE_VARIANTS[i]
}

/** One sprite per tile, in row-major order (index = ty × width + tx). */
export function buildGround(map: TileMap): Container {
  const ground = new Container()
  for (let ty = 0; ty < map.height; ty++) {
    for (let tx = 0; tx < map.width; tx++) {
      const sprite = makeSprite(groundAsset(map, tx, ty))
      const w = tileToWorld(tx, ty)
      sprite.position.set(w.x, w.y)
      ground.addChild(sprite)
    }
  }
  return ground
}

export function buildBuildings(map: TileMap, into: Container): void {
  for (const { type, x, y } of map.buildings) {
    into.addChild(makeBuildingSprite(type, { x, y }))
  }
}

/** A building sprite standing on its footprint, depth-sorted by its center. */
export function makeBuildingSprite(type: BuildingType, origin: Point): Sprite {
  const sprite = makeSprite(type)
  placeOnFootprint(sprite, type, origin)
  return sprite
}

function placeOnFootprint(
  sprite: Sprite,
  type: BuildingType,
  origin: Point,
): void {
  const c = footprintCenter(type, origin.x, origin.y)
  const w = gridToWorld(c.x, c.y)
  sprite.position.set(w.x, w.y)
  sprite.zIndex = gridToZIndex(c.x, c.y)
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
  /** Source of randomness for crew behavior; injectable for tests. */
  random?: () => number
}

/** The scene and its input handling, independent of the Pixi Application. */
export class Game {
  readonly map: TileMap
  readonly camera = new Camera()
  /** Player robots, in ROBOT_KINDS order. */
  readonly robots: Robot[]
  /** One sprite per tile, row-major as built by buildGround. */
  readonly ground: Container
  /** Ambient terrain animations, drawn just above the ground. */
  readonly tileEffects: TileEffects
  /** Tile highlights, drawn between the ground and objects. */
  readonly overlay = new Graphics()
  /** Ring under the selected robot, drawn between the ground and objects. */
  readonly selectionRing = new Graphics()
  /** Buildings and units, depth-sorted. */
  readonly objects = new Container()
  /** Screen-space HUD; add `dashboard.view` above the camera world. */
  readonly dashboard = new Dashboard()
  /** Crew out roaming around radar stations. */
  readonly spacemen: Spaceman[] = []

  hoverTile: Point | null = null
  /** Continuous grid position under the cursor, while over the map. */
  hoverGrid: Point | null = null
  /** Translucent preview of the selected building under the cursor. */
  ghost: Sprite | null = null
  /** Seconds until each radar station next tries to send someone out. */
  private readonly spawnTimers = new Map<Building, number>()
  private readonly random: () => number
  private press: {
    x: number
    y: number
    dragging: boolean
    /** Press started on the dashboard: never pans or hits the map. */
    onMenu: boolean
  } | null = null

  constructor({ mapSize, seed, viewport, random = Math.random }: GameOptions) {
    this.random = random
    const center = { x: mapSize / 2, y: mapSize / 2 }
    this.map = generateMap(mapSize, mapSize, seed, center)
    this.ground = buildGround(this.map)
    this.tileEffects = new TileEffects(this.map, this.ground, random)

    this.objects.sortableChildren = true
    this.camera.world.addChild(
      this.ground,
      this.tileEffects.view,
      this.overlay,
      this.selectionRing,
      this.objects,
      this.tileEffects.airView,
    )
    buildBuildings(this.map, this.objects)

    // Side by side in the clear area around the center.
    this.robots = ROBOT_KINDS.map(
      (kind, i) => new Robot(center.x + i, center.y, kind),
    )
    for (const r of this.robots) this.objects.addChild(r.sprite)

    const start = tileToWorld(center.x, center.y)
    this.camera.lookAt(
      start.x,
      start.y,
      viewport.width / 2,
      viewport.height / 2,
    )
    this.resize(viewport.width, viewport.height)
  }

  /** The robot the player is currently controlling. */
  get selRobot(): Robot {
    return this.robots[this.dashboard.selectedRobot]
  }

  /** Where the selected robot is headed, if anywhere. */
  get goalTile(): Point | null {
    return this.selRobot.goal
  }

  /** Re-layout screen-space UI after the viewport changes size. */
  resize(width: number, height: number): void {
    this.dashboard.layout(width, height)
  }

  /** Whether a building could be placed with its origin at a tile now. */
  canBuild(type: BuildingType, origin: Point): boolean {
    if (!this.map.canPlace(type, origin.x, origin.y)) return false
    // Don't build on top of anyone, or where they're about to step.
    const occupied = [...this.robots, ...this.spacemen].flatMap((w) => [
      w.tile,
      w.pathStart,
    ])
    return !footprint(type, origin.x, origin.y).some((t) =>
      occupied.some((o) => o.x === t.x && o.y === t.y),
    )
  }

  /** Place a building if the footprint allows it; returns whether it did. */
  build(type: BuildingType, origin: Point): boolean {
    if (!this.canBuild(type, origin)) return false
    this.map.place(type, origin.x, origin.y)
    this.objects.addChild(makeBuildingSprite(type, origin))
    // The new building may sit on a robot's route; re-plan around it.
    for (const robot of this.robots) {
      if (!robot.goal) continue
      const path = findPath(this.map, robot.pathStart, robot.goal)
      robot.setPath(path ?? [robot.pathStart])
      if (!path) robot.goal = null
    }
    // Spacemen whose route is now blocked stop and pick a new one.
    for (const s of this.spacemen) {
      if (s.remainingPath.some((t) => !this.map.isWalkable(t.x, t.y))) {
        s.setPath([s.pathStart])
      }
    }
    return true
  }

  pointerDown(sx: number, sy: number): void {
    const onMenu = this.dashboard.contains(sx, sy)
    this.press = { x: sx, y: sy, dragging: false, onMenu }
  }

  pointerMove(sx: number, sy: number): void {
    const press = this.press
    if (press && !press.onMenu) {
      const dx = sx - press.x
      const dy = sy - press.y
      if (press.dragging || Math.hypot(dx, dy) > DRAG_THRESHOLD) {
        press.dragging = true
        this.camera.panBy(dx, dy)
        press.x = sx
        press.y = sy
      }
    }
    const g = this.camera.screenToGrid(sx, sy)
    const t = this.camera.screenToTile(sx, sy)
    const overMap = this.map.isInBounds(t.x, t.y)
    const visible = overMap && !this.dashboard.contains(sx, sy)
    this.hoverTile = visible ? t : null
    this.hoverGrid = visible ? g : null
  }

  /**
   * Ends a press. A click on the dashboard selects a robot, tool or building; a
   * click on the map places the selected building, or otherwise sends the
   * selected robot there.
   */
  pointerUp(sx: number, sy: number): void {
    const press = this.press
    this.press = null
    if (!press || press.dragging) return
    if (press.onMenu) {
      this.withToolSync(() => this.dashboard.click(sx, sy))
      return
    }
    const selected = this.dashboard.build.selected
    if (selected) {
      const g = this.camera.screenToGrid(sx, sy)
      this.build(selected, footprintOrigin(selected, g))
      return
    }
    const t = this.camera.screenToTile(sx, sy)
    const path = this.map.isInBounds(t.x, t.y)
      ? findPath(this.map, this.selRobot.pathStart, t)
      : null
    if (path) {
      this.selRobot.setPath(path)
      this.selRobot.goal = t
    }
  }

  cancelPress(): void {
    this.press = null
  }

  keyDown(key: string): void {
    this.withToolSync(() => this.dashboard.keyDown(key))
  }

  /**
   * Run a dashboard interaction, then reconcile the tool bar with the
   * selected robot: switching robots shows the new robot's tool; otherwise
   * the bar's choice becomes the robot's tool.
   */
  private withToolSync(interact: () => void): void {
    const before = this.selRobot
    interact()
    if (this.selRobot !== before) {
      this.dashboard.tools.select(this.selRobot.tool)
    } else {
      this.selRobot.tool = this.dashboard.tools.selected
    }
  }

  /** Apply a tool to a tile; returns whether it changed anything. */
  useTool(tool: ToolType, tile: Point): boolean {
    switch (tool) {
      case "terraform":
        return this.terraform(tile)
    }
  }

  /**
   * Flatten ice, rocks or a crater into plain regolith, with an effect
   * for how it's done: nitrogen freezes ice, a laser melts rock, and
   * craters get filled in a cloud of dirt.
   */
  terraform(tile: Point): boolean {
    const t = this.map.getTile(tile.x, tile.y)
    if (!TERRAFORMABLE.has(t.terrain)) return false
    const was = t.terrain as TerraformableTerrain
    t.terrain = "regolith"
    this.tileEffects.forgetTile(tile)
    const sprite = this.ground.children[
      tile.y * this.map.width + tile.x
    ] as Sprite
    sprite.texture = Texture.from("regolith")
    sprite.label = "regolith"
    // A cancelled ice shake may have left it off-center.
    const w = tileToWorld(tile.x, tile.y)
    sprite.position.set(w.x, w.y)
    this.tileEffects.play(tile, TERRAFORM_EFFECTS[was])
    return true
  }

  wheel(deltaY: number, sx: number, sy: number): void {
    this.camera.zoomAt(Math.exp(-deltaY * 0.001), sx, sy)
  }

  update(deltaSeconds: number): void {
    // First, so effects robots trigger below get a frame before aging.
    this.tileEffects.update(deltaSeconds)
    for (const robot of this.robots) {
      const wasMoving = robot.isMoving
      robot.update(deltaSeconds)
      if (robot.isMoving) continue
      robot.goal = null
      // Stopping on a tile uses the robot's tool there.
      if (wasMoving && robot.tool) this.useTool(robot.tool, robot.tile)
    }
    this.updateCrew(deltaSeconds)

    const { x, y } = this.selRobot.sprite.position
    this.selectionRing
      .clear()
      .ellipse(x, y, SELECTION_RING_RADIUS, SELECTION_RING_RADIUS / 2)
      .stroke({ color: this.selRobot.kind.color, width: 2 })

    this.overlay.clear()
    for (const robot of this.robots) {
      if (robot.goal) {
        drawTileOutline(this.overlay, robot.goal, GOAL_COLOR, 0.9)
      }
    }
    const selected = this.dashboard.build.selected
    const origin =
      selected && this.hoverGrid
        ? footprintOrigin(selected, this.hoverGrid)
        : null
    if (selected && origin) {
      const color = this.canBuild(selected, origin)
        ? HOVER_COLOR
        : BLOCKED_COLOR
      for (const t of footprint(selected, origin.x, origin.y)) {
        drawTileOutline(this.overlay, t, color, 0.8)
      }
    } else if (this.hoverTile) {
      const { x, y } = this.hoverTile
      const color = this.map.isWalkable(x, y) ? HOVER_COLOR : BLOCKED_COLOR
      drawTileOutline(this.overlay, this.hoverTile, color, 0.8)
    }
    this.updateGhost(selected, origin)
  }

  /** Send crew out of radar stations, move them, and let returnees in. */
  private updateCrew(deltaSeconds: number): void {
    for (const station of this.map.buildings) {
      if (station.type !== "radar") continue
      const left = (this.spawnTimers.get(station) ?? 0) - deltaSeconds
      if (left > 0) {
        this.spawnTimers.set(station, left)
        continue
      }
      this.spawnTimers.set(station, SPAWN_MIN + this.random() * SPAWN_RANGE)
      const out = this.spacemen.filter((s) => s.station === station).length
      const doors = this.map.doorsOf(station)
      if (out >= MAX_SPACEMEN_PER_STATION || doors.length === 0) continue
      const door = doors[Math.floor(this.random() * doors.length)]
      const spaceman = new Spaceman(station, door, this.random)
      this.spacemen.push(spaceman)
      this.objects.addChild(spaceman.sprite)
    }

    for (const s of this.spacemen) s.think(this.map, deltaSeconds)
    for (let i = this.spacemen.length - 1; i >= 0; i--) {
      if (this.spacemen[i].state !== "home") continue
      this.spacemen[i].sprite.destroy()
      this.spacemen.splice(i, 1)
    }
  }

  private updateGhost(
    selected: BuildingType | null,
    origin: Point | null,
  ): void {
    if (!selected || !origin) {
      this.ghost?.destroy()
      this.ghost = null
      return
    }
    if (this.ghost?.label !== selected) {
      this.ghost?.destroy()
      this.ghost = makeSprite(selected)
      this.ghost.alpha = GHOST_ALPHA
      this.objects.addChild(this.ghost)
    }
    placeOnFootprint(this.ghost, selected, origin)
    this.ghost.tint = this.canBuild(selected, origin) ? 0xffffff : BLOCKED_COLOR
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
    window.addEventListener("keydown", (e) => this.keyDown(e.key))
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
