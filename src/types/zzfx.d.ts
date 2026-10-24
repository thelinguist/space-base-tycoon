// zzfx ships without types; this covers the parts we use.
declare module "zzfx" {
  /** Play a sound from ZzFX parameters (see src/constants/sounds.ts). */
  export function zzfx(...parameters: (number | undefined)[]): unknown
  export const ZZFX: {
    /** Master volume, 0–1. */
    volume: number
    audioContext: AudioContext
  }
}
