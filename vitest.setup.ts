// jsdom has no canvas implementation; return null instead of logging
// "Not implemented" every time Pixi probes for a 2D context. This must run
// before Pixi loads, hence the dynamic imports below.
HTMLCanvasElement.prototype.getContext = () => null

const { Cache, Texture } = await import("pixi.js")
const { ASSET_NAMES } = await import("./src/assets")

// Tests don't fetch real SVGs; give every asset alias a stand-in texture.
for (const name of ASSET_NAMES) Cache.set(name, Texture.WHITE)
