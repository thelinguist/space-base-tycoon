import { describe, expect, it } from "vitest"
import { DEFAULT_SEED, formatParams, parseParams } from "./params"
import { SCENES } from "./scenes"

describe("sandbox params", () => {
  it("reads the scene and seed from the query string", () => {
    expect(parseParams("?scene=terraform-ice&seed=42", SCENES)).toEqual({
      sceneId: "terraform-ice",
      seed: 42,
    })
  })

  it("falls back to the first scene and default seed", () => {
    expect(parseParams("", SCENES)).toEqual({
      sceneId: SCENES[0].id,
      seed: DEFAULT_SEED,
    })
    expect(parseParams("?scene=nope&seed=1.5", SCENES)).toEqual({
      sceneId: SCENES[0].id,
      seed: DEFAULT_SEED,
    })
    expect(parseParams("?seed=abc", SCENES).seed).toBe(DEFAULT_SEED)
    expect(parseParams("?seed=0", SCENES).seed).toBe(0)
  })

  it("round-trips through formatParams", () => {
    const p = { sceneId: "radar-crew", seed: -7 }
    expect(formatParams(p)).toBe("?scene=radar-crew&seed=-7")
    expect(parseParams(formatParams(p), SCENES)).toEqual(p)
  })
})
