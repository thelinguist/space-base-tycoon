import { Assets, Sprite, Texture } from "pixi.js"

export type TerrainType = "regolith" | "rocky" | "crater" | "ice"
export type BuildingType = "habitat" | "radar"

interface SpriteDef {
  src: string
  /**
   * Anchor = the point in the image that sits on the object's ground
   * position (tile center for tiles, footprint center for buildings, feet for
   * units).
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

/** Ice looks, differing only in crack pattern; plain "ice" is the first. */
export const ICE_VARIANTS = ["ice", "ice2", "ice3", "ice4"] as const
export type IceVariant = (typeof ICE_VARIANTS)[number]

const TERRAIN_VARIANTS: Record<Exclude<IceVariant, "ice">, SpriteDef> = {
  ice2: { src: "/assets/tiles/ice-2.svg", anchor: { x: 0.5, y: 0.5 } },
  ice3: { src: "/assets/tiles/ice-3.svg", anchor: { x: 0.5, y: 0.5 } },
  ice4: { src: "/assets/tiles/ice-4.svg", anchor: { x: 0.5, y: 0.5 } },
}

// Building images are 64px wide per footprint tile, with the footprint
// diamond at the bottom; the anchor is the footprint diamond's center.
const BUILDINGS: Record<BuildingType, SpriteDef> = {
  habitat: { src: "/assets/tiles/habitat.svg", anchor: { x: 0.5, y: 56 / 72 } },
  radar: { src: "/assets/tiles/radar.svg", anchor: { x: 0.5, y: 88 / 120 } },
}

const UNITS = {
  robot: { src: "/assets/sprites/robot.svg", anchor: { x: 0.5, y: 36 / 40 } },
  robotBlue: {
    src: "/assets/sprites/robot-blue.svg",
    anchor: { x: 0.5, y: 36 / 40 },
  },
  spaceman: {
    src: "/assets/sprites/spaceman.svg",
    anchor: { x: 0.5, y: 20 / 22 },
  },
} satisfies Record<string, SpriteDef>

export type UnitType = keyof typeof UNITS

// UI icons are anchored at the center.
const ICONS = {
  terraform: { src: "/assets/ui/terraform.svg", anchor: { x: 0.5, y: 0.5 } },
} satisfies Record<string, SpriteDef>

export type IconType = keyof typeof ICONS
export type AssetName =
  TerrainType | IceVariant | BuildingType | UnitType | IconType

const ALL: Record<string, SpriteDef> = {
  ...TERRAIN,
  ...TERRAIN_VARIANTS,
  ...BUILDINGS,
  ...UNITS,
  ...ICONS,
}

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
  sprite.label = name
  return sprite
}
