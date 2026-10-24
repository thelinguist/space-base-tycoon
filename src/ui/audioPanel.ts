import { AudioSettings } from "../audioSettings"

/**
 * A small corner panel: a mute toggle (also on the M key) and volume
 * sliders for ambience and sound effects. Plain DOM over the canvas, so
 * it's keyboard and screen-reader friendly; styled in public/style.css.
 */
export function mountAudioPanel(
  parent: HTMLElement,
  settings: AudioSettings,
): HTMLElement {
  const panel = document.createElement("div")
  panel.className = "audio-panel"

  const mute = document.createElement("button")
  mute.type = "button"
  mute.className = "audio-mute"
  mute.title = "Mute (M)"
  mute.onclick = () => settings.toggleMute()

  const slider = (label: string, onInput: (v: number) => void) => {
    const wrap = document.createElement("label")
    wrap.textContent = label
    const input = document.createElement("input")
    input.type = "range"
    input.min = "0"
    input.max = "100"
    input.oninput = () => onInput(Number(input.value) / 100)
    wrap.append(input)
    return { wrap, input }
  }
  const ambience = slider("AMBIENCE", (v) =>
    settings.update({ ambienceVolume: v }),
  )
  const sfx = slider("SFX", (v) => settings.update({ sfxVolume: v }))

  const sync = () => {
    mute.textContent = settings.muted ? "SOUND: OFF" : "SOUND: ON"
    mute.setAttribute("aria-pressed", String(settings.muted))
    ambience.input.value = String(Math.round(settings.ambienceVolume * 100))
    sfx.input.value = String(Math.round(settings.sfxVolume * 100))
    panel.classList.toggle("muted", settings.muted)
  }
  settings.onChange(sync)
  sync()

  panel.append(mute, ambience.wrap, sfx.wrap)
  parent.append(panel)
  return panel
}
