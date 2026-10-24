import { Ambience, AMBIENCE_FADE_IN } from "./ambience"
import { AudioSettings } from "./audioSettings"
import { Sound } from "./constants/sounds"

type ZzfxModule = typeof import("zzfx")

/** ZzFX's master volume at full SFX volume (its own default). */
export const SFX_MASTER = 0.3

/**
 * Plays ZzFX sounds and the ambient bed, following the player's audio
 * settings. zzfx creates its AudioContext as soon as it's imported, and
 * browsers keep audio suspended until the player interacts with the page,
 * so everything starts on the first click or key press (`unlock`). Until
 * then, and if audio is unavailable, it stays silent.
 */
export class SoundPlayer {
  /** Temporary mute, e.g. while fast-forwarding; separate from settings. */
  muted = false
  ambience: Ambience | null = null
  private zzfx: ZzfxModule | null = null
  private loading: Promise<void> | null = null

  constructor(
    private readonly load: () => Promise<ZzfxModule> = () => import("zzfx"),
    readonly settings: AudioSettings = new AudioSettings(),
    private readonly createAmbience: (ctx: AudioContext) => Ambience = (ctx) =>
      new Ambience(ctx),
  ) {
    settings.onChange(() => this.applySettings())
  }

  /** Load and resume audio. Call from a user gesture; safe to repeat. */
  unlock(): Promise<void> {
    this.loading ??= this.load().then(
      (m) => {
        this.zzfx = m
        const ctx = m.ZZFX.audioContext
        void ctx.resume()
        this.ambience = this.createAmbience(ctx)
        this.applySettings(AMBIENCE_FADE_IN)
      },
      () => {
        // No Web Audio here; stay silent.
      },
    )
    return this.loading
  }

  playSound(sound: Sound): void {
    if (this.zzfx && !this.muted && !this.settings.muted) {
      this.zzfx.zzfx(...sound)
    }
  }

  /** Run `fn` with sound muted, e.g. while fast-forwarding a replay. */
  silently(fn: () => void): void {
    const was = this.muted
    this.muted = true
    try {
      fn()
    } finally {
      this.muted = was
    }
  }

  /** Suspend all audio while the page is hidden, and resume after. */
  setPaused(paused: boolean): void {
    const ctx = this.zzfx?.ZZFX.audioContext
    if (!ctx) return
    void (paused ? ctx.suspend() : ctx.resume())
  }

  private applySettings(fadeSeconds?: number): void {
    if (!this.zzfx) return
    this.zzfx.ZZFX.volume = SFX_MASTER * this.settings.sfxLevel
    this.ambience?.setLevel(this.settings.ambienceLevel, fadeSeconds)
  }
}

/** Shared by the game and the sandbox so one unlock covers both. */
export const sound = new SoundPlayer()
