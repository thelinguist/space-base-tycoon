import { Scene } from "./scene"

export const DEFAULT_SEED = 1

/** Sandbox state kept in the URL, so a refresh or shared link restores it. */
export interface SandboxParams {
  sceneId: string
  seed: number
}

/** Read params from a query string, falling back for missing/bad values. */
export function parseParams(search: string, scenes: Scene[]): SandboxParams {
  const q = new URLSearchParams(search)
  const id = q.get("scene")
  const seed = Number(q.get("seed"))
  return {
    sceneId: scenes.some((s) => s.id === id) ? id! : scenes[0].id,
    seed: q.has("seed") && Number.isInteger(seed) ? seed : DEFAULT_SEED,
  }
}

export function formatParams({ sceneId, seed }: SandboxParams): string {
  return `?${new URLSearchParams({ scene: sceneId, seed: String(seed) })}`
}
