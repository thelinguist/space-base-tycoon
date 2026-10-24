import { describe, expect, it } from "vitest"
import { ROBOT_KINDS } from "../robot"
import { BUILD_ITEMS, Dashboard, TOOL_ITEMS } from "./dashboard"

/** Screen point at the center of button `i` in a bar. */
function buttonCenter(view: { x: number; y: number }, i: number) {
  return { x: view.x + 8 + i * 64 + 28, y: view.y + 8 + 28 }
}

describe("Dashboard", () => {
  it("offers a button per robot, tool and building", () => {
    const d = new Dashboard()
    expect(d.robots.items.map((i) => i.label)).toEqual(["YELLOW", "BLUE"])
    expect(d.robots.items.map((i) => i.icon)).toEqual(["robot", "robotBlue"])
    expect(d.build.items).toBe(BUILD_ITEMS)
    expect(BUILD_ITEMS.map((i) => i.id)).toEqual(["habitat", "radar"])
    expect(d.tools.items).toBe(TOOL_ITEMS)
    expect(TOOL_ITEMS.map((i) => i.id)).toEqual(["terraform"])
    expect(d.view.children).toEqual([d.robots.view, d.tools.view, d.build.view])
  })

  it("starts with the first robot and no building selected", () => {
    const d = new Dashboard()
    expect(d.selectedRobot).toBe(0)
    expect(d.tools.selected).toBeNull()
    expect(d.build.selected).toBeNull()
  })

  it("centers the panels side by side at the bottom", () => {
    const d = new Dashboard()
    d.layout(1000, 700)
    const total = d.robots.width + d.tools.width + d.build.width + 2 * 16
    expect(d.robots.view.x).toBe(Math.round((1000 - total) / 2))
    expect(d.tools.view.x).toBe(d.robots.view.x + d.robots.width + 16)
    expect(d.build.view.x).toBe(d.tools.view.x + d.tools.width + 16)
    expect(d.robots.view.y).toBe(700 - d.robots.height - 16)
    expect(d.tools.view.y).toBe(d.robots.view.y)
    expect(d.build.view.y).toBe(d.robots.view.y)
  })

  it("clicks and hotkeys select tools; Escape clears build, then tool", () => {
    const d = new Dashboard()
    d.layout(1000, 700)
    const terra = buttonCenter(d.tools.view, 0)
    d.click(terra.x, terra.y)
    expect(d.tools.selected).toBe("terraform")
    d.keyDown("t")
    expect(d.tools.selected).toBeNull()

    d.keyDown("T")
    d.keyDown("1")
    d.keyDown("Escape")
    expect(d.build.selected).toBeNull()
    expect(d.tools.selected).toBe("terraform")
    d.keyDown("Escape")
    expect(d.tools.selected).toBeNull()
  })

  it("hit-tests both panels but not the gap between them", () => {
    const d = new Dashboard()
    d.layout(1000, 700)
    const y = d.robots.view.y + 4
    expect(d.contains(d.robots.view.x + 4, y)).toBe(true)
    expect(d.contains(d.build.view.x + 4, y)).toBe(true)
    expect(d.contains(d.build.view.x - 8, y)).toBe(false)
  })

  it("routes clicks to the panel under the pointer", () => {
    const d = new Dashboard()
    d.layout(1000, 700)
    const blue = buttonCenter(d.robots.view, 1)
    d.click(blue.x, blue.y)
    expect(d.selectedRobot).toBe(1)
    expect(d.build.selected).toBeNull()

    const radar = buttonCenter(d.build.view, 1)
    d.click(radar.x, radar.y)
    expect(d.build.selected).toBe("radar")
    expect(d.selectedRobot).toBe(1)
  })

  it("routes hotkeys to whichever panel owns them", () => {
    const d = new Dashboard()
    d.keyDown(ROBOT_KINDS[1].hotkey)
    expect(d.selectedRobot).toBe(1)
    d.keyDown("1")
    expect(d.build.selected).toBe("habitat")
    d.keyDown("Escape")
    expect(d.build.selected).toBeNull()
    d.keyDown("Escape") // nothing left to clear
    expect(d.selectedRobot).toBe(1)
  })
})
