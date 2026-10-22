import { BuildingType, TerrainType } from "./assets"
import { Point } from "./iso"
import { hash, perlinNoise } from "./utils/noise"

export interface Tile {
  terrain: TerrainType
  building: BuildingType | null
}

/** The 2D logical map. Knows nothing about rendering. */
export class TileMap {
  readonly tiles: Tile[]

  constructor(
    readonly width: number,
    readonly height: number,
  ) {
    this.tiles = Array.from({ length: width * height }, () => ({
      terrain: "regolith" as TerrainType,
      building: null,
    }))
  }

  isInBounds(tx: number, ty: number): boolean {
    return tx >= 0 && ty >= 0 && tx < this.width && ty < this.height
  }

  getTile(tx: number, ty: number): Tile {
    return this.tiles[ty * this.width + tx]
  }

  isWalkable(tx: number, ty: number): boolean {
    return this.isInBounds(tx, ty) && this.getTile(tx, ty).building === null
  }
}

// --- Generation -----------------------------------------------------------

/** Size of ice features, in tiles. */
const ICE_SCALE = 7
/** Perlin values below this become ice (~13% of the map on average). */
const ICE_THRESHOLD = 0.33

export function generateMap(
  width: number,
  height: number,
  seed: number,
  keepClear: Point,
): TileMap {
  const map = new TileMap(width, height)

  for (let ty = 0; ty < height; ty++) {
    for (let tx = 0; tx < width; tx++) {
      const tile = map.getTile(tx, ty)
      const n = perlinNoise(tx, ty, ICE_SCALE, seed)
      const r = hash(tx, ty, seed + 1)
      if (n < ICE_THRESHOLD) tile.terrain = "ice"
      else if (r < 0.04) tile.terrain = "crater"
      else if (r < 0.12) tile.terrain = "rocky"
      else tile.terrain = "regolith"
    }
  }

  // Scatter some habitats, leaving the area around `keepClear` open.
  let placed = 0
  for (let i = 0; placed < 14 && i < 500; i++) {
    const tx = Math.floor(hash(i, 0, seed + 2) * width)
    const ty = Math.floor(hash(i, 1, seed + 2) * height)
    const tile = map.getTile(tx, ty)
    const nearStart =
      Math.abs(tx - keepClear.x) <= 1 && Math.abs(ty - keepClear.y) <= 1
    if (nearStart || tile.terrain !== "regolith" || tile.building) continue
    tile.building = "habitat"
    placed++
  }

  return map
}
