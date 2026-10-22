import { Assets, Sprite, Texture } from "pixi.js"

export type TerrainType = "regolith" | "rocky" | "crater" | "ice"
export type BuildingType = "habitat"

interface SpriteDef {
  src: string
  /**
   * Anchor = the point in the image that sits on the object's ground
   * position (tile center for tiles/buildings, feet for units).
   */
  anchor: { x: number; y: number }
}

// Flat terrain images are exactly one 64×32 diamond, anchored at the center.
const TERRAIN: Record<TerrainType, SpriteDef> = {
  regolith: { src: "/assets/tiles/regolith.svg", anchor: { x: 0.5, y: 0.5 } },
  rocky: { src: "/assets/tiles/rocky.svg", anchor: { x: 0.5, y: 0.5 } },
  crater: { src: "/assets/tiles/crater.svg", anchor: { x: 0.5, y: 0.5 } },
  ice: { src: "/assets/tiles/ice.svg", anchor: { x: 0.5, y: 0.5 } },
}

// Building images are 64 wide with the footprint diamond at the bottom;
// the footprint center is 16px above the bottom edge.
const BUILDINGS: Record<BuildingType, SpriteDef> = {
  habitat: { src: "/assets/tiles/habitat.svg", anchor: { x: 0.5, y: 56 / 72 } },
}

const UNITS = {
  robot: { src: "/assets/sprites/robot.svg", anchor: { x: 0.5, y: 36 / 40 } },
} satisfies Record<string, SpriteDef>

export type UnitType = keyof typeof UNITS
export type AssetName = TerrainType | BuildingType | UnitType

const ALL: Record<string, SpriteDef> = { ...TERRAIN, ...BUILDINGS, ...UNITS }

/** Every loadable asset alias. */
export const ASSET_NAMES = Object.keys(ALL) as AssetName[]

/** Rasterize SVGs at 2× so they stay crisp when zoomed in. */
const SVG_RESOLUTION = 2

export async function loadAssets(): Promise<void> {
  for (const [alias, def] of Object.entries(ALL)) {
    Assets.add({ alias, src: def.src, data: { resolution: SVG_RESOLUTION } })
  }
  await Assets.load(ASSET_NAMES)
}

/** Create a sprite for any loaded asset, already anchored correctly. */
export function makeSprite(name: AssetName): Sprite {
  const def = ALL[name]
  const sprite = new Sprite(Texture.from(name))
  sprite.anchor.set(def.anchor.x, def.anchor.y)
  return sprite
}
