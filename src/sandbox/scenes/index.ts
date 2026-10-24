import { Scene } from "../scene"
import { radarCrew } from "./radar"
import { terraformScene } from "./terraform"

/** Every sandbox scene, in sidebar order. */
export const SCENES: Scene[] = [
  radarCrew,
  terraformScene("crater", "Crater"),
  terraformScene("rocky", "Rocky"),
  terraformScene("ice", "Ice"),
]

export function findScene(id: string): Scene | undefined {
  return SCENES.find((s) => s.id === id)
}
