import { BuildingType, TerrainType } from "./assets"
import { Point } from "./iso"
import { hash, perlinNoise } from "./utils/noise"

/** Side length, in tiles, of each building's square footprint. */
export const BUILDING_SIZE: Record<BuildingType, number> = {
  habitat: 1,
  radar: 2,
}

/** Terrain that can be built on; craters and ice can't hold foundations. */
export const BUILDABLE_TERRAIN: ReadonlySet<TerrainType> = new Set([
  "regolith",
  "rocky",
])

/** A placed building. (x, y) is its footprint's minimum (top) tile. */
export interface Building {
  type: BuildingType
  x: number
  y: number
}

export interface Tile {
  terrain: TerrainType
  /** The building covering this tile, shared by its whole footprint. */
  building: Building | null
}

/** Every tile a building of `type` would cover with its origin at (x, y). */
export function footprint(type: BuildingType, x: number, y: number): Point[] {
  const size = BUILDING_SIZE[type]
  const tiles: Point[] = []
  for (let dy = 0; dy < size; dy++) {
    for (let dx = 0; dx < size; dx++) tiles.push({ x: x + dx, y: y + dy })
  }
  return tiles
}

/** Grid position of a building's footprint center, where its sprite stands. */
export function footprintCenter(
  type: BuildingType,
  x: number,
  y: number,
): Point {
  const half = BUILDING_SIZE[type] / 2
  return { x: x + half, y: y + half }
}

/** The 2D logical map. Knows nothing about rendering. */
export class TileMap {
  readonly tiles: Tile[]
  readonly buildings: Building[] = []

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

  /** Whether every footprint tile is in bounds, empty and buildable. */
  canPlace(type: BuildingType, x: number, y: number): boolean {
    return footprint(type, x, y).every(
      (t) =>
        this.isWalkable(t.x, t.y) &&
        BUILDABLE_TERRAIN.has(this.getTile(t.x, t.y).terrain),
    )
  }

  /** Walkable tiles sharing an edge with a building's footprint. */
  doorsOf(building: Building): Point[] {
    const { type, x, y } = building
    const size = BUILDING_SIZE[type]
    const doors: Point[] = []
    for (let i = 0; i < size; i++) {
      doors.push(
        { x: x + i, y: y - 1 },
        { x: x + size, y: y + i },
        { x: x + i, y: y + size },
        { x: x - 1, y: y + i },
      )
    }
    return doors.filter((t) => this.isWalkable(t.x, t.y))
  }

  /** Place a building without checks; callers validate with canPlace. */
  place(type: BuildingType, x: number, y: number): Building {
    const building = { type, x, y }
    for (const t of footprint(type, x, y)) {
      this.getTile(t.x, t.y).building = building
    }
    this.buildings.push(building)
    return building
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
    map.place("habitat", tx, ty)
    placed++
  }

  return map
}
