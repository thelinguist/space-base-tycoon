import { Sprite } from "pixi.js"
import { makeSprite } from "./assets"
import { gridToZIndex, gridToTile, gridToWorld, Point, tileCenter } from "./iso"

/** Movement speed in tiles per second. */
const SPEED = 3

export class Robot {
  readonly sprite: Sprite
  /** Logical position in continuous grid space. */
  readonly pos: Point
  /** Remaining tiles to visit, in order. */
  private path: Point[] = []

  constructor(tx: number, ty: number) {
    this.pos = tileCenter(tx, ty)
    this.sprite = makeSprite("robot")
    this.syncSprite()
  }

  /** The tile pathfinding should start from: the one we're heading into. */
  get pathStart(): Point {
    return this.path[0] ?? gridToTile(this.pos.x, this.pos.y)
  }

  get isMoving(): boolean {
    return this.path.length > 0
  }

  /** Follow a tile path whose first tile is `pathStart`. */
  setPath(path: Point[]): void {
    this.path = path
  }

  update(deltaSeconds: number): void {
    let budget = SPEED * deltaSeconds
    while (budget > 0 && this.path.length > 0) {
      const target = tileCenter(this.path[0].x, this.path[0].y)
      const dx = target.x - this.pos.x
      const dy = target.y - this.pos.y
      const dist = Math.hypot(dx, dy)
      if (dist <= budget) {
        this.pos.x = target.x
        this.pos.y = target.y
        this.path.shift()
        budget -= dist
      } else {
        this.pos.x += (dx / dist) * budget
        this.pos.y += (dy / dist) * budget
        budget = 0
      }
      // Face left/right based on on-screen direction (world dx ∝ gx - gy).
      const screenDx = dx - dy
      if (Math.abs(screenDx) > 1e-6) {
        this.sprite.scale.x = Math.sign(screenDx)
      }
    }
    this.syncSprite()
  }

  private syncSprite(): void {
    const w = gridToWorld(this.pos.x, this.pos.y)
    this.sprite.position.set(w.x, w.y)
    this.sprite.zIndex = gridToZIndex(this.pos.x, this.pos.y)
  }
}
