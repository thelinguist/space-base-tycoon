import { describe, expect, it } from "vitest"
import { Camera } from "./camera"
import { gridToWorld, tileToWorld } from "./iso"

describe("Camera", () => {
  it("is the identity transform by default", () => {
    const cam = new Camera()
    expect(cam.zoom).toBe(1)
    expect(cam.screenToWorld(10, 20)).toEqual({ x: 10, y: 20 })
    expect(cam.worldToScreen(10, 20)).toEqual({ x: 10, y: 20 })
  })

  it("lookAt places a world point at a screen point", () => {
    const cam = new Camera()
    cam.lookAt(100, 50, 400, 300)
    expect(cam.worldToScreen(100, 50)).toEqual({ x: 400, y: 300 })
    expect(cam.screenToWorld(400, 300)).toEqual({ x: 100, y: 50 })
  })

  it("pans by a screen offset", () => {
    const cam = new Camera()
    cam.panBy(15, -5)
    expect(cam.worldToScreen(0, 0)).toEqual({ x: 15, y: -5 })
  })

  it("zooms around the cursor, keeping that world point fixed", () => {
    const cam = new Camera()
    cam.lookAt(0, 0, 200, 200)
    const before = cam.screenToWorld(300, 250)
    cam.zoomAt(2, 300, 250)
    expect(cam.zoom).toBe(2)
    const after = cam.screenToWorld(300, 250)
    expect(after.x).toBeCloseTo(before.x)
    expect(after.y).toBeCloseTo(before.y)
  })

  it("clamps zoom", () => {
    const cam = new Camera()
    cam.zoomAt(100, 0, 0)
    expect(cam.zoom).toBe(3)
    cam.zoomAt(0.0001, 0, 0)
    expect(cam.zoom).toBe(0.5)
  })

  it("converts screen points to grid positions and tiles", () => {
    const cam = new Camera()
    cam.zoomAt(2, 0, 0)
    cam.lookAt(0, 0, 500, 100)
    const w = tileToWorld(7, 3)
    const s = cam.worldToScreen(w.x, w.y)
    expect(cam.screenToTile(s.x, s.y)).toEqual({ x: 7, y: 3 })

    const g = gridToWorld(2.25, 9.75)
    const s2 = cam.worldToScreen(g.x, g.y)
    const back = cam.screenToGrid(s2.x, s2.y)
    expect(back.x).toBeCloseTo(2.25)
    expect(back.y).toBeCloseTo(9.75)
  })
})
