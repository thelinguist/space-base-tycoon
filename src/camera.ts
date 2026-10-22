import { Container, Point as PixiPoint } from "pixi.js"
import { Point, worldToGrid, worldToTile } from "./iso"

const MIN_ZOOM = 0.5
const MAX_ZOOM = 3

/**
 * Manages the world container's pan/zoom and the screen ↔ world conversion.
 * Combined with iso.ts this gives screen ↔ world ↔ grid.
 */
export class Camera {
  readonly world = new Container()

  /** Screen space → world space. */
  screenToWorld(sx: number, sy: number): Point {
    const p = this.world.toLocal(new PixiPoint(sx, sy))
    return { x: p.x, y: p.y }
  }

  /** World space → screen space. */
  worldToScreen(wx: number, wy: number): Point {
    const p = this.world.toGlobal(new PixiPoint(wx, wy))
    return { x: p.x, y: p.y }
  }

  /** Screen space → continuous grid space. */
  screenToGrid(sx: number, sy: number): Point {
    const w = this.screenToWorld(sx, sy)
    return worldToGrid(w.x, w.y)
  }

  /** Screen space → the tile under that pixel. */
  screenToTile(sx: number, sy: number): Point {
    const w = this.screenToWorld(sx, sy)
    return worldToTile(w.x, w.y)
  }

  get zoom(): number {
    return this.world.scale.x
  }

  /** Place world point (wx, wy) at screen point (sx, sy). */
  lookAt(wx: number, wy: number, sx: number, sy: number): void {
    this.world.position.set(sx - wx * this.zoom, sy - wy * this.zoom)
  }

  panBy(dx: number, dy: number): void {
    this.world.position.x += dx
    this.world.position.y += dy
  }

  /** Zoom by a factor, keeping the world point under (sx, sy) fixed. */
  zoomAt(factor: number, sx: number, sy: number): void {
    const anchor = this.screenToWorld(sx, sy)
    const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, this.zoom * factor))
    this.world.scale.set(zoom)
    this.lookAt(anchor.x, anchor.y, sx, sy)
  }
}
