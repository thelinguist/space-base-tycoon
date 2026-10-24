import { describe, expect, it } from "vitest"
import { AudioSettings } from "../audioSettings"
import { mountAudioPanel } from "./audioPanel"

function mount() {
  const settings = new AudioSettings(null)
  const parent = document.createElement("div")
  const panel = mountAudioPanel(parent, settings)
  const [ambience, sfx] = panel.querySelectorAll("input")
  const mute = panel.querySelector("button")!
  return { settings, parent, panel, ambience, sfx, mute }
}

describe("audio panel", () => {
  it("mounts a mute button and two labelled sliders", () => {
    const { parent, panel, ambience, sfx, mute } = mount()
    expect(parent.contains(panel)).toBe(true)
    expect(mute.textContent).toBe("SOUND: ON")
    expect(mute.getAttribute("aria-pressed")).toBe("false")
    expect(ambience.closest("label")!.textContent).toBe("AMBIENCE")
    expect(sfx.closest("label")!.textContent).toBe("SFX")
    expect(ambience.value).toBe("60")
    expect(sfx.value).toBe("100")
  })

  it("the button toggles mute", () => {
    const { settings, panel, mute } = mount()
    mute.click()
    expect(settings.muted).toBe(true)
    expect(mute.textContent).toBe("SOUND: OFF")
    expect(mute.getAttribute("aria-pressed")).toBe("true")
    expect(panel.classList.contains("muted")).toBe(true)
  })

  it("sliders set the volumes", () => {
    const { settings, ambience, sfx } = mount()
    ambience.value = "25"
    ambience.dispatchEvent(new Event("input"))
    sfx.value = "80"
    sfx.dispatchEvent(new Event("input"))
    expect(settings.ambienceVolume).toBe(0.25)
    expect(settings.sfxVolume).toBe(0.8)
  })

  it("reflects changes made elsewhere, like the M key", () => {
    const { settings, sfx, mute } = mount()
    settings.update({ muted: true, sfxVolume: 0.3 })
    expect(mute.textContent).toBe("SOUND: OFF")
    expect(sfx.value).toBe("30")
  })
})
