// Sandbox entry point: DOM and Pixi wiring only. Scene setup, timing and
// URL handling live in their own modules so they stay testable.
import { Application, Container, Graphics, Text } from "pixi.js"
import { loadAssets } from "../assets"
import { BACKGROUND_COLOR, UI_TEXT_COLOR } from "../constants/color"
import { Game } from "../game"
import { sound } from "../sound"
import { tileToWorld } from "../iso"
import { seededRandom } from "../utils/random"
import { drawGrid } from "./grid"
import { formatParams, parseParams } from "./params"
import { Scene } from "./scene"
import { findScene, SCENES } from "./scenes"
import { STEP, Timeline } from "./timeline"

const SPEEDS = [0.1, 0.25, 1, 2, 4]

const $ = <T extends HTMLElement>(id: string) =>
  document.getElementById(id) as T

;(async () => {
  const stage = $<HTMLElement>("stage")
  const app = new Application()
  await app.init({ background: BACKGROUND_COLOR, resizeTo: stage })
  stage.appendChild(app.canvas)
  await loadAssets()

  const params = parseParams(location.search, SCENES)
  let scene: Scene = findScene(params.sceneId)!
  let seed = params.seed
  let timeline = new Timeline(scene.loop)
  let game: Game | null = null
  let grid: Container | null = null
  let playing = true
  let speed = 1
  let showGrid = false
  /** Wheel zoom on top of the scene's own, kept across rebuilds. */
  let userZoom = 1

  // --- Scene lifecycle -------------------------------------------------

  function teardown(): void {
    if (!game) return
    game.camera.world.destroy({ children: true })
    game.dashboard.view.destroy({ children: true })
    game = null
    grid = null
  }

  function build(): void {
    teardown()
    game = scene.build({ random: seededRandom(seed), viewport: app.screen })
    const { width, height } = app.screen
    game.camera.zoomAt(scene.zoom * userZoom, width / 2, height / 2)
    app.stage.addChild(game.camera.world)
    if (showGrid) addGrid()
  }

  function addGrid(): void {
    if (!game) return
    grid = new Container()
    grid.addChild(drawGrid(new Graphics(), game.map))
    for (let y = 0; y < game.map.height; y++) {
      for (let x = 0; x < game.map.width; x++) {
        const label = new Text({
          text: `${x},${y}`,
          style: { fontFamily: "monospace", fontSize: 8, fill: UI_TEXT_COLOR },
        })
        const w = tileToWorld(x, y)
        label.anchor.set(0.5)
        label.alpha = 0.6
        label.position.set(w.x, w.y)
        grid.addChild(label)
      }
    }
    // Above the ground and effects, below units and buildings.
    game.camera.world.addChildAt(grid, 2)
  }

  function apply({ rebuild, steps }: { rebuild: boolean; steps: number }) {
    const run = () => {
      for (let i = 0; i < steps; i++) game!.update(STEP)
    }
    if (rebuild || !game) {
      build()
      // Replaying from the start: don't blast every past sound at once.
      sound.silently(run)
    } else {
      run()
    }
    syncControls()
  }

  function selectScene(next: Scene): void {
    scene = next
    timeline = new Timeline(scene.loop)
    apply(timeline.replay())
    syncUrl()
    renderSceneList()
  }

  function setSeed(next: number): void {
    seed = next
    apply(timeline.replay())
    syncUrl()
  }

  // --- DOM -------------------------------------------------------------

  const playBtn = $<HTMLButtonElement>("play")
  const timeInput = $<HTMLInputElement>("time")
  const clock = $<HTMLElement>("clock")
  const seedInput = $<HTMLInputElement>("seed")
  const gridBtn = $<HTMLButtonElement>("grid")

  function syncUrl(): void {
    history.replaceState(null, "", formatParams({ sceneId: scene.id, seed }))
  }

  function syncControls(): void {
    playBtn.textContent = playing ? "▮▮" : "▶"
    timeInput.max = String(timeline.loopSteps - 1)
    timeInput.value = String(timeline.steps)
    clock.textContent = `${timeline.time.toFixed(2)}s / ${scene.loop}s`
    seedInput.value = String(seed)
    gridBtn.classList.toggle("active", showGrid)
  }

  function renderSceneList(): void {
    const nav = $<HTMLElement>("scenes")
    nav.querySelectorAll("button").forEach((b) => b.remove())
    for (const s of SCENES) {
      const b = document.createElement("button")
      b.textContent = s.name
      b.classList.toggle("active", s === scene)
      b.onclick = () => selectScene(s)
      nav.appendChild(b)
    }
  }

  function renderSpeeds(): void {
    const box = $<HTMLElement>("speeds")
    box.replaceChildren(
      ...SPEEDS.map((s) => {
        const b = document.createElement("button")
        b.textContent = `${s}×`
        b.classList.toggle("active", s === speed)
        b.onclick = () => {
          speed = s
          renderSpeeds()
        }
        return b
      }),
    )
  }

  function togglePlay(): void {
    playing = !playing
    syncControls()
  }

  function stepBy(dir: 1 | -1): void {
    playing = false
    apply(dir > 0 ? timeline.stepForward() : timeline.stepBack())
  }

  function toggleGrid(): void {
    showGrid = !showGrid
    if (showGrid) {
      addGrid()
    } else {
      grid?.destroy({ children: true })
      grid = null
    }
    syncControls()
  }

  playBtn.onclick = togglePlay
  $("back").onclick = () => stepBy(-1)
  $("forward").onclick = () => stepBy(1)
  timeInput.oninput = () => apply(timeline.seek(Number(timeInput.value) * STEP))
  seedInput.onchange = () => {
    const n = Number(seedInput.value)
    if (Number.isInteger(n)) setSeed(n)
  }
  $("reseed").onclick = () => setSeed(Math.floor(Math.random() * 1e6))
  gridBtn.onclick = toggleGrid

  // Browsers only allow audio after the user interacts with the page.
  window.addEventListener("pointerdown", () => void sound.unlock())
  window.addEventListener("keydown", (e) => {
    void sound.unlock()
    if (e.target instanceof HTMLInputElement) return
    if (e.key === " ") togglePlay()
    else if (e.key === "ArrowLeft") stepBy(-1)
    else if (e.key === "ArrowRight") stepBy(1)
    else if (e.key === "g") toggleGrid()
    else return
    e.preventDefault()
  })

  app.canvas.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault()
      const factor = Math.exp(-e.deltaY * 0.001)
      userZoom *= factor
      game?.camera.zoomAt(factor, e.offsetX, e.offsetY)
    },
    { passive: false },
  )
  // The camera centers on build, so rebuild in place for the new size.
  app.renderer.on("resize", () => apply(timeline.replay()))

  // --- Go --------------------------------------------------------------

  renderSceneList()
  renderSpeeds()
  syncUrl()
  apply(timeline.replay())
  app.ticker.add((t) => {
    if (playing) apply(timeline.advance((t.deltaMS / 1_000) * speed))
  })
})()
