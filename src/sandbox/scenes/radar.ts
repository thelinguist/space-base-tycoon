import { Game } from "../../game"
import { makeMap, Scene } from "../scene"

/** One radar station sending crew out to roam and come back. */
export const radarCrew: Scene = {
  id: "radar-crew",
  name: "Radar / Crew spawning",
  // Long enough for the first spacemen to roam ~30s and return.
  loop: 45,
  zoom: 1.25,
  build({ random, viewport }) {
    const map = makeMap(12, 12)
    map.place("radar", 5, 5)
    return new Game({
      map,
      robotTiles: [
        { x: 0, y: 11 },
        { x: 1, y: 11 },
      ],
      random,
      viewport,
    })
  },
}
