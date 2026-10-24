import { describe, expect, it, vi } from "vitest"
import {
  AUDIO_PREFS_KEY,
  AudioSettings,
  DEFAULT_AUDIO_PREFS,
} from "./audioSettings"

function memoryStore(initial?: object) {
  const data = new Map<string, string>()
  if (initial) data.set(AUDIO_PREFS_KEY, JSON.stringify(initial))
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
  }
}

describe("AudioSettings", () => {
  it("starts from defaults", () => {
    const s = new AudioSettings(null)
    expect(s.muted).toBe(DEFAULT_AUDIO_PREFS.muted)
    expect(s.sfxVolume).toBe(DEFAULT_AUDIO_PREFS.sfxVolume)
    expect(s.ambienceVolume).toBe(DEFAULT_AUDIO_PREFS.ambienceVolume)
  })

  it("muting zeroes the effective levels but keeps the volumes", () => {
    const s = new AudioSettings(null)
    s.update({ sfxVolume: 0.4, ambienceVolume: 0.3 })
    expect([s.sfxLevel, s.ambienceLevel]).toEqual([0.4, 0.3])
    s.toggleMute()
    expect([s.sfxLevel, s.ambienceLevel]).toEqual([0, 0])
    expect([s.sfxVolume, s.ambienceVolume]).toEqual([0.4, 0.3])
    s.toggleMute()
    expect(s.muted).toBe(false)
  })

  it("clamps volumes to 0–1 and ignores junk", () => {
    const s = new AudioSettings(null)
    s.update({ sfxVolume: 2, ambienceVolume: -1 })
    expect([s.sfxVolume, s.ambienceVolume]).toEqual([1, 0])
    s.update({ sfxVolume: NaN })
    expect(s.sfxVolume).toBe(1)
  })

  it("notifies listeners on every change", () => {
    const s = new AudioSettings(null)
    const listener = vi.fn()
    s.onChange(listener)
    s.update({ sfxVolume: 0.5 })
    s.toggleMute()
    expect(listener).toHaveBeenCalledTimes(2)
  })

  it("saves and restores", () => {
    const store = memoryStore()
    new AudioSettings(store).update({ muted: true, sfxVolume: 0.25 })
    const restored = new AudioSettings(store)
    expect(restored.muted).toBe(true)
    expect(restored.sfxVolume).toBe(0.25)
    expect(restored.ambienceVolume).toBe(DEFAULT_AUDIO_PREFS.ambienceVolume)
  })

  it("sanitizes saved values", () => {
    const s = new AudioSettings(
      memoryStore({ muted: "yes", sfxVolume: 9, ambienceVolume: "loud" }),
    )
    expect(s.muted).toBe(false)
    expect(s.sfxVolume).toBe(1)
    expect(s.ambienceVolume).toBe(DEFAULT_AUDIO_PREFS.ambienceVolume)
  })

  it("survives corrupt or throwing storage", () => {
    const corrupt = memoryStore()
    corrupt.data.set(AUDIO_PREFS_KEY, "{not json")
    expect(new AudioSettings(corrupt).sfxVolume).toBe(1)

    const throwing = {
      getItem: () => {
        throw new Error("blocked")
      },
      setItem: () => {
        throw new Error("blocked")
      },
    }
    const s = new AudioSettings(throwing)
    expect(() => s.update({ muted: true })).not.toThrow()
    expect(s.muted).toBe(true)
  })

  it("uses localStorage by default, or nothing if it's blocked", () => {
    window.localStorage.removeItem(AUDIO_PREFS_KEY)
    new AudioSettings().update({ sfxVolume: 0.75 })
    expect(window.localStorage.getItem(AUDIO_PREFS_KEY)).toContain("0.75")
    window.localStorage.removeItem(AUDIO_PREFS_KEY)

    const spy = vi
      .spyOn(window, "localStorage", "get")
      .mockImplementation(() => {
        throw new Error("blocked")
      })
    expect(() => new AudioSettings().update({ muted: true })).not.toThrow()
    spy.mockRestore()
  })
})
