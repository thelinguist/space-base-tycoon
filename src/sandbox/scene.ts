import { TerrainType } from "../assets"
import { Game } from "../game"
import { TileMap } from "../map"

export interface SceneContext {
  /** Seeded, so a scene replays identically for the same seed. */
  random: () => number
  viewport: { width: number; height: number }
}

/** A small, self-contained setup showing off one feature. */
export interface Scene {
  /** URL key, e.g. "terraform-ice". */
  id: string
  /** Sidebar label; "Group / Name" reads well. */
  name: string
  /** Seconds before the scene rebuilds and plays again. */
  loop: number
  /** Camera zoom to frame the scene. */
  zoom: number
  build(ctx: SceneContext): Game
}

export type TileSpec = [x: number, y: number, terrain: TerrainType]

/** A regolith map with some tiles set to other terrain. */
export function makeMap(
  width: number,
  height: number,
  terrain: TileSpec[] = [],
): TileMap {
  const map = new TileMap(width, height)
  for (const [x, y, t] of terrain) map.getTile(x, y).terrain = t
  return map
}
