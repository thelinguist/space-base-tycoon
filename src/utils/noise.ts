/**
 * Deterministic randomness for procedural generation. Every function is
 * pure: the same inputs (including seed) always give the same output.
 */

/** Deterministic hash of two integers and a seed → [0, 1). */
export function hash(x: number, y: number, seed: number): number {
  let h = (x * 374761393 + y * 668265263 + seed * 1442695041) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

/** Cubic ease (3t² − 2t³): zero slope at 0 and 1. */
function smoothstep(t: number): number {
  return t * t * (3 - 2 * t)
}

/** Quintic ease (6t⁵ − 15t⁴ + 10t³): zero slope and curvature at 0 and 1. */
function fade(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10)
}

/**
 * Smooth value noise in [0, 1). Random values on a lattice spaced `scale`
 * apart, blended between the four surrounding lattice points.
 */
export function valueNoise(
  x: number,
  y: number,
  scale: number,
  seed: number,
): number {
  const fx = x / scale
  const fy = y / scale
  const x0 = Math.floor(fx)
  const y0 = Math.floor(fy)
  const sx = smoothstep(fx - x0)
  const sy = smoothstep(fy - y0)
  const top = lerp(hash(x0, y0, seed), hash(x0 + 1, y0, seed), sx)
  const bottom = lerp(hash(x0, y0 + 1, seed), hash(x0 + 1, y0 + 1, seed), sx)
  return lerp(top, bottom, sy)
}

/**
 * Dot product of the random unit gradient at lattice point (ix, iy) with the
 * offset (dx, dy) from that point.
 */
function gradientDot(
  ix: number,
  iy: number,
  dx: number,
  dy: number,
  seed: number,
): number {
  const angle = hash(ix, iy, seed) * Math.PI * 2
  return Math.cos(angle) * dx + Math.sin(angle) * dy
}

/**
 * 2D Perlin (gradient) noise in [0, 1]. Each lattice point, spaced `scale`
 * apart, has a random gradient direction; the value at a point blends how far
 * it lies "uphill" along each of the four surrounding gradients. Compared to
 * value noise this gives rounder, less grid-aligned features.
 *
 * Values cluster around 0.5 (exactly 0.5 on lattice points) and rarely reach
 * the extremes, so pick thresholds accordingly.
 */
export function perlinNoise(
  x: number,
  y: number,
  scale: number,
  seed: number,
): number {
  const fx = x / scale
  const fy = y / scale
  const x0 = Math.floor(fx)
  const y0 = Math.floor(fy)
  const dx = fx - x0
  const dy = fy - y0

  const top = lerp(
    gradientDot(x0, y0, dx, dy, seed),
    gradientDot(x0 + 1, y0, dx - 1, dy, seed),
    fade(dx),
  )
  const bottom = lerp(
    gradientDot(x0, y0 + 1, dx, dy - 1, seed),
    gradientDot(x0 + 1, y0 + 1, dx - 1, dy - 1, seed),
    fade(dx),
  )
  // Raw 2D Perlin with unit gradients lies in [−√½, √½]; rescale to [0, 1].
  const n = lerp(top, bottom, fade(dy)) / Math.SQRT1_2
  return (n + 1) / 2
}
