import { TerrainType } from "./assets"

/** Something a robot does to the tile it stops on. */
export type ToolType = "terraform"

export type TerraformableTerrain = Exclude<TerrainType, "regolith">

/** Terrain the terraform tool flattens into regolith. */
export const TERRAFORMABLE: ReadonlySet<TerrainType> =
  new Set<TerraformableTerrain>(["ice", "rocky", "crater"])
