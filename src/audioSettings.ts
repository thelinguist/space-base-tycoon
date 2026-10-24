/** Player-facing audio preferences, saved between visits. */
export interface AudioPrefs {
  muted: boolean
  /** Sound effects volume, 0–1. */
  sfxVolume: number
  /** Ambience volume, 0–1. */
  ambienceVolume: number
}

export const DEFAULT_AUDIO_PREFS: AudioPrefs = {
  muted: false,
  sfxVolume: 1,
  ambienceVolume: 0.6,
}

export const AUDIO_PREFS_KEY = "spacebasetycoon.audio"

/** The subset of Storage we use, so tests can pass a stand-in. */
type PrefStore = Pick<Storage, "getItem" | "setItem">

function clamp01(v: unknown, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v)
    ? Math.min(1, Math.max(0, v))
    : fallback
}

/**
 * Holds the audio preferences, notifies listeners when they change, and
 * saves them. Storage can be missing or throw (private browsing, blocked
 * site data); settings then simply don't persist.
 */
export class AudioSettings {
  private prefs: AudioPrefs
  private readonly listeners: (() => void)[] = []

  constructor(private readonly store: PrefStore | null = defaultStore()) {
    this.prefs = { ...DEFAULT_AUDIO_PREFS, ...this.read() }
  }

  get muted(): boolean {
    return this.prefs.muted
  }
  get sfxVolume(): number {
    return this.prefs.sfxVolume
  }
  get ambienceVolume(): number {
    return this.prefs.ambienceVolume
  }

  /** Effective volumes after muting. */
  get sfxLevel(): number {
    return this.muted ? 0 : this.sfxVolume
  }
  get ambienceLevel(): number {
    return this.muted ? 0 : this.ambienceVolume
  }

  update(changes: Partial<AudioPrefs>): void {
    this.prefs = {
      muted: changes.muted ?? this.prefs.muted,
      sfxVolume: clamp01(changes.sfxVolume, this.prefs.sfxVolume),
      ambienceVolume: clamp01(
        changes.ambienceVolume,
        this.prefs.ambienceVolume,
      ),
    }
    this.write()
    for (const listener of this.listeners) listener()
  }

  toggleMute(): void {
    this.update({ muted: !this.muted })
  }

  onChange(listener: () => void): void {
    this.listeners.push(listener)
  }

  private read(): Partial<AudioPrefs> {
    try {
      const raw = this.store?.getItem(AUDIO_PREFS_KEY)
      const saved = raw ? (JSON.parse(raw) as Record<string, unknown>) : {}
      return {
        muted: saved.muted === true,
        sfxVolume: clamp01(saved.sfxVolume, DEFAULT_AUDIO_PREFS.sfxVolume),
        ambienceVolume: clamp01(
          saved.ambienceVolume,
          DEFAULT_AUDIO_PREFS.ambienceVolume,
        ),
      }
    } catch {
      return {}
    }
  }

  private write(): void {
    try {
      this.store?.setItem(AUDIO_PREFS_KEY, JSON.stringify(this.prefs))
    } catch {
      // Not persisted this time; the in-memory settings still apply.
    }
  }
}

function defaultStore(): PrefStore | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}
