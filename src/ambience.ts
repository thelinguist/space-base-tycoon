/**
 * The planet's background bed: gusting wind, synthesized with Web Audio
 * from filtered noise so nothing audibly loops. Slow LFOs at unrelated
 * rates drive the gusts, so they never fall into a pattern.
 */

/** Overall loudness at full ambience volume; kept well under the SFX. */
export const AMBIENCE_MASTER = 0.15
/** Fade-in when audio first starts. */
export const AMBIENCE_FADE_IN = 3
/** Fade when the volume or mute changes. */
const LEVEL_FADE = 0.2

const WIND_LEVEL = 0.3
const WIND_FREQUENCY = 261.63
/** How far gusts sweep the wind's pitch, in Hz. */
const GUST_SWEEP = 300
/** How much gusts swell the wind's volume. */
const GUST_SWELL = 0.35
/** Gust LFO rates in Hz; unrelated so the pattern doesn't repeat. */
const GUST_RATES = [0.05, 0.13]

/** Seconds of noise in the looped wind buffer. */
const NOISE_SECONDS = 2

export class Ambience {
  /** Everything mixes into this; its gain is the ambience level. */
  readonly output: GainNode

  constructor(
    private readonly ctx: BaseAudioContext,
    random: () => number = Math.random,
  ) {
    this.output = ctx.createGain()
    this.output.gain.value = 0
    this.output.connect(ctx.destination)
    this.buildWind(random)
  }

  /** Fade to a level from 0 (silent) to 1 (full ambience volume). */
  setLevel(level: number, seconds = LEVEL_FADE): void {
    const gain = this.output.gain
    const now = this.ctx.currentTime
    gain.cancelScheduledValues(now)
    gain.setValueAtTime(gain.value, now)
    gain.linearRampToValueAtTime(level * AMBIENCE_MASTER, now + seconds)
  }

  private buildWind(random: () => number): void {
    const { ctx } = this
    const length = Math.floor(ctx.sampleRate * NOISE_SECONDS)
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate)
    const samples = buffer.getChannelData(0)
    for (let i = 0; i < length; i++) samples[i] = random() * 2 - 1

    const noise = ctx.createBufferSource()
    noise.buffer = buffer
    noise.loop = true

    const filter = ctx.createBiquadFilter()
    filter.type = "bandpass"
    filter.frequency.value = WIND_FREQUENCY
    filter.Q.value = 0.8

    const level = ctx.createGain()
    level.gain.value = WIND_LEVEL

    noise.connect(filter).connect(level).connect(this.output)
    this.lfo(GUST_RATES[0], GUST_SWEEP, filter.frequency)
    this.lfo(GUST_RATES[1], GUST_SWELL, level.gain)
    noise.start()
  }

  /** A slow sine that wobbles `param` by ±`depth` around its value. */
  private lfo(rate: number, depth: number, param: AudioParam): void {
    const osc = this.ctx.createOscillator()
    osc.frequency.value = rate
    const amount = this.ctx.createGain()
    amount.gain.value = depth
    osc.connect(amount).connect(param)
    osc.start()
  }
}
