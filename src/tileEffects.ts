import { Container, Graphics, Sprite, Texture } from "pixi.js"
import { ICE_VARIANTS, TerrainType } from "./assets"
import { Point, TILE_HEIGHT, TILE_WIDTH, tileToWorld } from "./iso"
import { TileMap } from "./map"

/**
 * Short ambient animations that play on random ground tiles: ice cracks
 * shift, rocky ground glints, craters puff dust.
 *
 * Effects are drawn in tile-local "diamond space": (u, v) ∈ [-1, 1]²
 * covers exactly one tile's diamond, with u and v running along the
 * grid's x and y axes. See diamondToLocal.
 */

/** One play of an effect. */
export interface EffectInstance {
  /** Drawn relative to the tile center, or null for effects that only
   * change the ground sprite. */
  readonly view: Graphics | null
  /**
   * Draw above buildings and units instead of just above the ground, for
   * effects that should engulf whatever stands on the tile.
   */
  readonly inAir?: boolean
  /** Seconds. */
  readonly duration: number
  /** Update at progress t ∈ [0, 1]. */
  animate(t: number): void
  /** Called once when the effect ends. */
  finish?(): void
}

/** A running effect, positioned on its tile. */
export interface Effect extends EffectInstance {
  readonly tile: Point
  /** Sits at the tile center and holds `view`. */
  readonly holder: Container
  age: number
}

export type CreateEffect = (
  random: () => number,
  ground: Sprite,
  tile: Point,
) => EffectInstance

interface EffectDef {
  /** Average plays per tile per second. */
  rate: number
  create: CreateEffect
}

/** Tile-local diamond coordinates → pixel offset from the tile center. */
export function diamondToLocal(u: number, v: number): Point {
  return {
    x: ((u - v) * TILE_WIDTH) / 4,
    y: ((u + v) * TILE_HEIGHT) / 4,
  }
}

// --- Effects ----------------------------------------------------------------

/** Shake offsets in whole pixels, stepped through over the shake. */
const SHAKE_STEPS = [1, -1, 1, 0, -1, 0]

/**
 * The ice settles: the tile shakes by a pixel, then its cracks shift to a
 * different pattern. Acts on the ground sprite rather than drawing.
 */
function crackShift(
  random: () => number,
  ground: Sprite,
  tile: Point,
): EffectInstance {
  const home = tileToWorld(tile.x, tile.y)
  return {
    view: null,
    duration: 0.3,
    animate(t) {
      const step = Math.min(
        SHAKE_STEPS.length - 1,
        Math.floor(t * SHAKE_STEPS.length),
      )
      ground.x = home.x + SHAKE_STEPS[step]
    },
    finish() {
      ground.x = home.x
      const others = ICE_VARIANTS.filter((v) => v !== ground.label)
      const next = others[Math.floor(random() * others.length)]
      ground.texture = Texture.from(next)
      ground.label = next
    },
  }
}

const GLINT_COLOR = 0xfff3c4

/** A pixel-art four-point sparkle that flares and fades. */
function glint(random: () => number): EffectInstance {
  const view = new Graphics()
    .rect(-3, -0.5, 6, 1)
    .rect(-0.5, -3, 1, 6)
    .rect(-1, -1, 2, 2)
    .fill(GLINT_COLOR)
  view.blendMode = "add"
  const p = diamondToLocal(random() * 1.2 - 0.6, random() * 1.2 - 0.6)
  view.position.set(Math.round(p.x), Math.round(p.y))
  return {
    view,
    duration: 0.6,
    animate(t) {
      const flare = Math.sin(Math.PI * t)
      view.scale.set(flare)
      view.alpha = flare
    },
  }
}

const DUST_COLOR = 0xcf7446
/** How far dust rises above the crater, in pixels. */
const DUST_RISE = 10

/** A few dust motes drifting up out of the crater and spreading. */
export function dust(random: () => number): EffectInstance {
  const view = new Graphics()
  for (let i = 0; i < 3; i++) {
    view.rect(Math.round((random() - 0.5) * 12), -i * 2, 2, 2)
  }
  view.fill(DUST_COLOR)
  return {
    view,
    duration: 1.6,
    animate(t) {
      view.y = -t * DUST_RISE
      view.scale.x = 1 + t
      view.alpha = 1 - t
    },
  }
}

export const TERRAIN_EFFECTS: Partial<Record<TerrainType, EffectDef>> = {
  ice: { rate: 1 / 90, create: crackShift },
  rocky: { rate: 1 / 15, create: glint },
  crater: { rate: 1 / 20, create: dust },
}

// --- Runner -----------------------------------------------------------------

/** Spawns, animates and removes terrain effects for a map. */
export class TileEffects {
  /** Effects drawn just above the ground. */
  readonly view = new Container()
  /** Effects drawn above buildings and units (see EffectInstance.inAir). */
  readonly airView = new Container()
  readonly active: Effect[] = []
  private readonly tilesByTerrain = new Map<TerrainType, Point[]>()
  /** Fractional effects owed per terrain, carried between frames. */
  private readonly owed = new Map<TerrainType, number>()

  constructor(
    private readonly map: TileMap,
    /** The map's ground sprites, row-major as built by buildGround. */
    private readonly ground: Container,
    private readonly random: () => number,
  ) {
    for (let ty = 0; ty < map.height; ty++) {
      for (let tx = 0; tx < map.width; tx++) {
        const terrain = map.getTile(tx, ty).terrain
        if (!TERRAIN_EFFECTS[terrain]) continue
        const list = this.tilesByTerrain.get(terrain) ?? []
        list.push({ x: tx, y: ty })
        this.tilesByTerrain.set(terrain, list)
      }
    }
  }

  update(deltaSeconds: number): void {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const effect = this.active[i]
      effect.age += deltaSeconds
      if (effect.age >= effect.duration) {
        effect.finish?.()
        effect.holder.destroy({ children: true })
        this.active.splice(i, 1)
      } else {
        effect.animate(effect.age / effect.duration)
      }
    }

    // New effects start after aging so they get at least one frame.
    // Each terrain plays rate × tiles effects per second on average, each
    // on a random tile, so any one tile animates at unpredictable times.
    for (const [terrain, tiles] of this.tilesByTerrain) {
      const def = TERRAIN_EFFECTS[terrain]!
      let owed =
        (this.owed.get(terrain) ?? 0) + def.rate * tiles.length * deltaSeconds
      for (; owed >= 1; owed--) {
        this.play(tiles[Math.floor(this.random() * tiles.length)], def.create)
      }
      this.owed.set(terrain, owed)
    }
  }

  /**
   * The tile's terrain changed: stop its ambient effects, current and
   * future. Its ground sprite is left for the caller to restyle.
   */
  forgetTile(tile: Point): void {
    const same = (t: Point) => t.x === tile.x && t.y === tile.y
    for (const [terrain, tiles] of this.tilesByTerrain) {
      this.tilesByTerrain.set(
        terrain,
        tiles.filter((t) => !same(t)),
      )
    }
    for (let i = this.active.length - 1; i >= 0; i--) {
      if (!same(this.active[i].tile)) continue
      this.active[i].holder.destroy({ children: true })
      this.active.splice(i, 1)
    }
  }

  /** Play an effect on a tile now, unless a building covers it. */
  play(tile: Point, create: CreateEffect): void {
    if (this.map.getTile(tile.x, tile.y).building) return
    const holder = new Container()
    const w = tileToWorld(tile.x, tile.y)
    holder.position.set(w.x, w.y)
    const sprite = this.ground.children[
      tile.y * this.map.width + tile.x
    ] as Sprite
    const effect = {
      ...create(this.random, sprite, tile),
      tile,
      holder,
      age: 0,
    }
    if (effect.view) holder.addChild(effect.view)
    ;(effect.inAir ? this.airView : this.view).addChild(holder)
    effect.animate(0)
    this.active.push(effect)
  }
}
