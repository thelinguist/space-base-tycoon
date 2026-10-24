// Entry point: only wires the Pixi Application to the Game. Keep logic in
// game.ts so it stays testable.
import { Application } from "pixi.js"
import { loadAssets } from "./assets"
import { BACKGROUND_COLOR } from "./constants/color"
import { Game } from "./game"
import { mountAudioPanel } from "./ui/audioPanel"

const MAP_SIZE = 64
const MAP_SEED = 1337

;(async () => {
  const app = new Application()
  await app.init({
    background: BACKGROUND_COLOR,
    resizeTo: window,
    antialias: true,
  })
  document.getElementById("pixi-container")!.appendChild(app.canvas)

  await loadAssets()

  const game = new Game({
    mapSize: MAP_SIZE,
    seed: MAP_SEED,
    viewport: app.screen,
  })
  app.stage.addChild(game.camera.world, game.dashboard.view)
  app.renderer.on("resize", (width, height) => game.resize(width, height))
  app.stage.hitArea = app.screen
  game.bindInput(app.stage, app.canvas)
  mountAudioPanel(document.body, game.sound.settings)

  app.ticker.add((time) => game.update(time.deltaMS / 1_000))
})()
