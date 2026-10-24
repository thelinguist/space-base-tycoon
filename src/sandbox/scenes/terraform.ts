import { Game } from "../../game"
import { TerraformableTerrain } from "../../tools"
import { makeMap, Scene } from "../scene"

const TARGET = { x: 3, y: 2 }

/** The yellow robot walks onto one tile of `terrain` and terraforms it. */
export function terraformScene(
  terrain: TerraformableTerrain,
  label: string,
): Scene {
  return {
    id: `terraform-${terrain}`,
    name: `Terraform / ${label}`,
    loop: 3.5,
    zoom: 2,
    build({ random, viewport }) {
      const game = new Game({
        map: makeMap(5, 5, [[TARGET.x, TARGET.y, terrain]]),
        robotTiles: [
          { x: 0, y: 2 },
          { x: 0, y: 4 },
        ],
        random,
        viewport,
      })
      const [yellow] = game.robots
      yellow.tool = "terraform"
      game.moveRobot(yellow, TARGET)
      return game
    },
  }
}
