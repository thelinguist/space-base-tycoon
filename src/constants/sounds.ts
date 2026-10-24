/* eslint-disable no-sparse-arrays -- gaps are ZzFX defaults, as its designer exports them */
import { TerraformableTerrain } from "../tools"

/**
 * ZzFX sound definitions. Each is ZzFX's parameter list:
 *
 *   volume, randomness, frequency, attack, sustain, release, shape,
 *   shapeCurve, slide, deltaSlide, pitchJump, pitchJumpTime, repeatTime,
 *   noise, modulation, bitCrush, delay, sustainVolume, decay, tremolo,
 *   filter
 *
 * Gaps take ZzFX's defaults. Shapes: 0 sine, 1 triangle, 2 saw, 3 tan,
 * 4 noise. Paste one into https://killedbyapixel.github.io/ZzFX/ to hear
 * and tweak it, then copy the array back. Arrays are kept in the
 * designer's compact format (prettier-ignore) so they round-trip.
 */
export type Sound = readonly (number | undefined)[]

/** Bright blip when a robot reaches the tile it was sent to. */
// prettier-ignore
export const ROBOT_ARRIVE: Sound = [1.2,,474,.01,.01,.07,5,1.017627900422891,2,-30,,,,,,.1,,.97,.04,,-1418]

/** Crater: a low, crunchy burst of noise as dirt fills the hole. */
// prettier-ignore
export const TERRAFORM_CRATER: Sound = [.5,.1,60,.01,.08,.35,4,1.5,,,,,,1.8,,.4,,.5,.15]

/** Rocky: a falling sawtooth zap for the laser. */
// prettier-ignore
export const TERRAFORM_ROCKY: Sound = [.5,.05,1400,,.12,.18,2,2.4,-70,,,,,,,,,.8,.04]

/** Ice: a long, high-passed hiss of liquid nitrogen. */
// prettier-ignore
export const TERRAFORM_ICE: Sound = [.4,.1,2000,.05,.5,.6,4,,,,,,,3,,,,.6,.2,,1500]

export const TERRAFORM_SOUNDS: Record<TerraformableTerrain, Sound> = {
  crater: TERRAFORM_CRATER,
  rocky: TERRAFORM_ROCKY,
  ice: TERRAFORM_ICE,
}

/** One stomp of a toy soldier's march, beaten while astronauts walk. */
// prettier-ignore
export const ARMY_MAN_MARCH: Sound = [.6,,103,.02,.02,.03,3,2.7,,,,,,,,,,.84,,,918]
