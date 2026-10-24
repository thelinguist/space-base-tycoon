import { Graphics } from "pixi.js"
import { CreateEffect, diamondToLocal, EffectInstance } from "./tileEffects"
import { TerraformableTerrain } from "./tools"

/**
 * One-off effects for the terraform tool, one per terrain it clears. All
 * draw in the air layer so they engulf the robot doing the work, and
 * snap to whole pixels to stay crisp.
 */

/** Fast start, gentle finish. */
function easeOut(t: number): number {
  return 1 - (1 - t) ** 5
}

/** A square of `size` pixels centered on (x, y), on whole pixels. */
function pixelSquare(g: Graphics, x: number, y: number, size: number) {
  const s = Math.max(1, Math.round(size))
  return g.rect(Math.round(x - s / 2), Math.round(y - s / 2), s, s)
}

// --- Crater: dirt cloud ------------------------------------------------------

const DIRT_COLORS = [0x6e3b22, 0x8a4a2a, 0xb4562f]
export const DIRT_PUFFS = 14
export const DIRT_SPECKS = 40

/**
 * A scruffy cloud of dirt bursts out around the robot and dissipates
 * quickly, with specks flung out and falling back.
 */
export function dirtCloud(random: () => number): EffectInstance {
  const view = new Graphics()
  const puffs = Array.from({ length: DIRT_PUFFS }, () => ({
    angle: random() * Math.PI * 2,
    reach: 6 + random() * 14,
    size: 4 + random() * 5,
    color: DIRT_COLORS[Math.floor(random() * DIRT_COLORS.length)],
  }))
  const specks = Array.from({ length: DIRT_SPECKS }, () => ({
    angle: random() * Math.PI * 2,
    speed: 22 + random() * 16,
    lift: 10 + random() * 10,
  }))
  return {
    view,
    inAir: true,
    duration: 0.7,
    animate(t) {
      view.clear()
      const e = easeOut(t)
      const fade = (1 - t) ** 2
      for (const p of puffs) {
        // Ground-hugging ellipse: half as tall as wide, drifting upward.
        const r = 3 + p.reach * e
        const x = Math.cos(p.angle) * r
        const y = Math.sin(p.angle) * r * 0.5 - 6 - e * 4
        pixelSquare(view, x, y, p.size * (1 + e * 0.6)).fill({
          color: p.color,
          alpha: fade,
        })
      }
      for (const s of specks) {
        const d = s.speed * t
        const x = Math.cos(s.angle) * d
        // Up and back down along a parabola.
        const y = Math.sin(s.angle) * d * 0.5 - s.lift * 4 * t * (1 - t)
        pixelSquare(view, x, y, 2).fill({ color: DIRT_COLORS[0], alpha: fade })
      }
    },
  }
}

// --- Rocky: laser ------------------------------------------------------------

/** How far above the tile the beam starts, in pixels. */
export const LASER_HEIGHT = 40
const LASER_GLOW = 0xff5a4d
const LASER_CORE = 0xffffff
const MOLTEN = 0xffa040
/** Share of the effect the beam itself is visible; then rock glows. */
const BEAM_SHARE = 0.45
const SPARKS = 8

/**
 * A beam flashes down from overhead, melting the rock into a glowing
 * puddle that cools while sparks spray out.
 */
export function laserMelt(random: () => number): EffectInstance {
  const view = new Graphics()
  view.blendMode = "add"
  const sparks = Array.from({ length: SPARKS }, () => ({
    angle: random() * Math.PI * 2,
    speed: 18 + random() * 18,
  }))
  return {
    view,
    inAir: true,
    duration: 0.6,
    animate(t) {
      view.clear()
      if (t < BEAM_SHARE) {
        const flash = Math.sin((Math.PI * t) / BEAM_SHARE)
        const glow = Math.round(2 + flash * 6)
        const core = Math.max(1, Math.round(flash * 2))
        view
          .rect(-glow / 2, -LASER_HEIGHT, glow, LASER_HEIGHT)
          .fill({ color: LASER_GLOW, alpha: 0.6 * flash })
          .rect(-core / 2, -LASER_HEIGHT, core, LASER_HEIGHT)
          .fill({ color: LASER_CORE, alpha: flash })
      }
      // Molten rock where the beam hit, cooling over the whole effect.
      const heat = 1 - t
      view
        .ellipse(0, 0, 6 + 10 * easeOut(Math.min(1, t * 2)), 3 + 5 * t)
        .fill({ color: MOLTEN, alpha: 0.9 * heat })
      for (const s of sparks) {
        const d = s.speed * t
        const x = Math.cos(s.angle) * d
        const y = Math.sin(s.angle) * d * 0.5 - 8 * t * (1 - t) * 4
        pixelSquare(view, x, y, 2).fill({ color: MOLTEN, alpha: heat })
      }
    },
  }
}

// --- Ice: liquid nitrogen ----------------------------------------------------

const FROST_COLORS = [0xffffff, 0xdff3fb]
/** How far out the cloud rolls, in pixels: to the frozen tile's corners. */
export const NITROGEN_REACH = diamondToLocal(1, -1).x
export const NITROGEN_PUFFS = 72
/** Radius in pixels of the tumble each puff makes as it rolls outward. */
export const ROLL_RADIUS = 3
/** Latest start, as a share of the effect, so puffs set off in waves. */
const MAX_DELAY = 0.35

/**
 * Liquid nitrogen flash-freezes the tile: a white cloud rolls out along
 * the ground in every direction, tumbling over itself as it goes, then
 * thins away.
 */
export function nitrogenFreeze(random: () => number): EffectInstance {
  const view = new Graphics()
  const puffs = Array.from({ length: NITROGEN_PUFFS }, (_, i) => ({
    angle: (i / NITROGEN_PUFFS) * Math.PI * 2 + random() * 0.3,
    delay: random() * MAX_DELAY,
    // Some puffs stop short of the front so the cloud has depth.
    reach: 0.6 + random() * 0.4,
    size: 10 + random() * 8,
    phase: random() * Math.PI * 2,
    color: FROST_COLORS[Math.floor(random() * FROST_COLORS.length)],
  }))
  return {
    view,
    inAir: true,
    duration: 1.0,
    animate(t) {
      view.clear()
      // Quick to appear, then a long fade.
      const alpha = Math.min(1, t * 8) * (1 - t) ** 1.5
      const drawn = []
      for (const p of puffs) {
        const local = (t - p.delay) / (1 - p.delay)
        if (local <= 0) continue
        const travel = NITROGEN_REACH * p.reach * easeOut(local)
        // Rolling: each puff is a point on a wheel whose axle travels
        // straight out, so it lifts up and over the cloud's leading edge
        // like a breaking wave instead of sliding or orbiting.
        const roll = p.phase + travel / ROLL_RADIUS
        const radial = travel + Math.sin(roll) * ROLL_RADIUS
        const lift = (1 - Math.cos(roll)) * ROLL_RADIUS
        drawn.push({
          x: Math.round(Math.cos(p.angle) * radial),
          y: Math.round(Math.sin(p.angle) * radial * 0.5 - 4 - lift),
          r: Math.round((p.size * (0.4 + 0.6 * local)) / 2),
          color: p.color,
          alpha: 0.85 * alpha * Math.min(1, local * 6),
        })
      }
      // Back to front, so nearer billows overlap farther ones.
      drawn.sort((a, b) => a.y - b.y)
      for (const d of drawn) {
        view.circle(d.x, d.y, d.r).fill({ color: d.color, alpha: d.alpha })
      }
    },
  }
}

export const TERRAFORM_EFFECTS: Record<TerraformableTerrain, CreateEffect> = {
  crater: dirtCloud,
  rocky: laserMelt,
  ice: nitrogenFreeze,
}
