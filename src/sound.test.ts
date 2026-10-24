import { describe, expect, it, vi } from "vitest"
import { Ambience, AMBIENCE_FADE_IN } from "./ambience"
import { AudioSettings } from "./audioSettings"
import { ROBOT_ARRIVE } from "./constants/sounds"
import { SFX_MASTER, sound, SoundPlayer } from "./sound"

/** A stand-in for the zzfx module and its AudioContext. */
function fakeZzfx() {
  const ctx = {
    resume: vi.fn(() => Promise.resolve()),
    suspend: vi.fn(() => Promise.resolve()),
  }
  const zzfx = vi.fn()
  const ZZFX = { volume: SFX_MASTER, audioContext: ctx }
  return {
    zzfx,
    ZZFX,
    ctx,
    load: vi.fn(() => Promise.resolve({ zzfx, ZZFX } as never)),
  }
}

function player(fake = fakeZzfx(), settings = new AudioSettings(null)) {
  const ambience = { setLevel: vi.fn() }
  const createAmbience = vi.fn(() => ambience as unknown as Ambience)
  const p = new SoundPlayer(fake.load, settings, createAmbience)
  return { p, fake, settings, ambience, createAmbience }
}

describe("SoundPlayer", () => {
  it("is silent until unlocked", async () => {
    const { p, fake } = player()
    p.playSound(ROBOT_ARRIVE)
    expect(fake.load).not.toHaveBeenCalled()

    await p.unlock()
    expect(fake.ctx.resume).toHaveBeenCalled()
    p.playSound(ROBOT_ARRIVE)
    expect(fake.zzfx).toHaveBeenCalledWith(...ROBOT_ARRIVE)
  })

  it("loads zzfx only once", async () => {
    const { p, fake, createAmbience } = player()
    await Promise.all([p.unlock(), p.unlock()])
    await p.unlock()
    expect(fake.load).toHaveBeenCalledOnce()
    expect(createAmbience).toHaveBeenCalledOnce()
  })

  it("stays silent if audio can't load", async () => {
    const p = new SoundPlayer(
      () => Promise.reject(new Error("no audio")),
      new AudioSettings(null),
    )
    await expect(p.unlock()).resolves.toBeUndefined()
    expect(() => p.playSound(ROBOT_ARRIVE)).not.toThrow()
    expect(() => p.setPaused(true)).not.toThrow()
    expect(p.ambience).toBeNull()
  })

  it("starts the ambience on unlock, fading in", async () => {
    const { p, fake, ambience, createAmbience } = player()
    await p.unlock()
    expect(createAmbience).toHaveBeenCalledWith(fake.ctx)
    expect(p.ambience).toBe(ambience)
    expect(ambience.setLevel).toHaveBeenCalledWith(0.6, AMBIENCE_FADE_IN)
  })

  it("follows volume and mute settings", async () => {
    const { p, fake, settings, ambience } = player()
    settings.update({ sfxVolume: 0.5 }) // before unlock: applied on unlock
    await p.unlock()
    expect(fake.ZZFX.volume).toBe(SFX_MASTER * 0.5)

    settings.update({ ambienceVolume: 0.2 })
    expect(ambience.setLevel).toHaveBeenLastCalledWith(0.2, undefined)

    settings.toggleMute()
    expect(fake.ZZFX.volume).toBe(0)
    expect(ambience.setLevel).toHaveBeenLastCalledWith(0, undefined)
    p.playSound(ROBOT_ARRIVE)
    expect(fake.zzfx).not.toHaveBeenCalled()
  })

  it("can be muted temporarily, apart from settings", async () => {
    const { p, fake } = player()
    await p.unlock()
    p.muted = true
    p.playSound(ROBOT_ARRIVE)
    expect(fake.zzfx).not.toHaveBeenCalled()
  })

  it("silently mutes for the duration of a call, even if it throws", async () => {
    const { p, fake } = player()
    await p.unlock()
    p.silently(() => p.playSound(ROBOT_ARRIVE))
    expect(fake.zzfx).not.toHaveBeenCalled()
    expect(p.muted).toBe(false)

    expect(() =>
      p.silently(() => {
        throw new Error("boom")
      }),
    ).toThrow("boom")
    expect(p.muted).toBe(false)

    p.muted = true
    p.silently(() => {})
    expect(p.muted).toBe(true)
  })

  it("suspends and resumes audio for hidden pages", async () => {
    const { p, fake } = player()
    p.setPaused(true) // not unlocked yet: nothing to do
    expect(fake.ctx.suspend).not.toHaveBeenCalled()
    await p.unlock()
    p.setPaused(true)
    expect(fake.ctx.suspend).toHaveBeenCalledOnce()
    fake.ctx.resume.mockClear()
    p.setPaused(false)
    expect(fake.ctx.resume).toHaveBeenCalledOnce()
  })

  it("loads the real zzfx by default", async () => {
    // jsdom has no AudioContext, so importing zzfx fails; that's the
    // "stay silent" path, which proves the default loader ran.
    const p = new SoundPlayer(undefined, new AudioSettings(null))
    await expect(p.unlock()).resolves.toBeUndefined()
  })

  it("builds a real Ambience by default", async () => {
    const fake = fakeZzfx()
    const p = new SoundPlayer(fake.load, new AudioSettings(null))
    // The fake context can't build audio nodes; seeing it try is enough.
    await expect(p.unlock()).rejects.toThrow()
  })

  it("exports a shared player", () => {
    expect(sound).toBeInstanceOf(SoundPlayer)
    expect(sound.settings).toBeInstanceOf(AudioSettings)
  })
})
