import { Graphics } from "pixi.js"
import { UI_TEXT_COLOR } from "../constants/color"
import { gridToWorld } from "../iso"
import { TileMap } from "../map"

/** Outline every tile, to read positions and footprints at a glance. */
export function drawGrid(g: Graphics, map: TileMap): Graphics {
  for (let y = 0; y <= map.height; y++) {
    const a = gridToWorld(0, y)
    const b = gridToWorld(map.width, y)
    g.moveTo(a.x, a.y).lineTo(b.x, b.y)
  }
  for (let x = 0; x <= map.width; x++) {
    const a = gridToWorld(x, 0)
    const b = gridToWorld(x, map.height)
    g.moveTo(a.x, a.y).lineTo(b.x, b.y)
  }
  return g.stroke({ color: UI_TEXT_COLOR, alpha: 0.35, width: 1 })
}
