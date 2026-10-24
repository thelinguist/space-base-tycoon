import { Graphics } from "pixi.js"
import { describe, expect, it, vi } from "vitest"
import { UI_BORDER_COLOR, UI_SELECTED_COLOR } from "../constants/color"
import { BarItem, ButtonBar } from "./buttonBar"

const ITEMS: BarItem<string>[] = [
  { id: "a", icon: "habitat", label: "A", hotkey: "1" },
  { id: "b", icon: "radar", label: "B", hotkey: "q" },
]

function toggleBar() {
  const bar = new ButtonBar(ITEMS, { toggle: true })
  bar.moveTo(100.4, 200.6)
  return bar
}

/** Screen point at the center of button `i` (56px buttons, 8px gaps). */
function buttonCenter(bar: ButtonBar<string>, i: number) {
  return { x: bar.view.x + 8 + i * 64 + 28, y: bar.view.y + 8 + 28 }
}

/** Border color the button frame was last stroked with. */
function borderColor(bar: ButtonBar<string>, i: number): number {
  const frame = bar.view.children[1 + i * 4] as Graphics
  const stroke = vi.spyOn(frame, "stroke")
  bar.select(bar.selected) // force a redraw
  const color = (stroke.mock.lastCall![0] as { color: number }).color
  stroke.mockRestore()
  return color
}

describe("ButtonBar", () => {
  it("sizes the panel to fit its buttons", () => {
    const bar = toggleBar()
    expect(bar.width).toBe(8 * 2 + 56 * 2 + 8)
    expect(bar.height).toBe(8 * 2 + 56 + 14)
    // Panel + (frame, icon, hotkey, label) per button.
    expect(bar.view.children).toHaveLength(1 + 2 * 4)
  })

  it("moves to whole-pixel screen positions", () => {
    const bar = toggleBar()
    expect(bar.view.position.x).toBe(100)
    expect(bar.view.position.y).toBe(201)
  })

  it("hit-tests the panel", () => {
    const bar = toggleBar()
    const { x, y } = bar.view
    expect(bar.contains(x, y)).toBe(true)
    expect(bar.contains(x + bar.width - 1, y + bar.height - 1)).toBe(true)
    expect(bar.contains(x - 1, y)).toBe(false)
    expect(bar.contains(x, y - 1)).toBe(false)
    expect(bar.contains(x + bar.width, y)).toBe(false)
    expect(bar.contains(x, y + bar.height)).toBe(false)
  })

  it("finds the button under a point", () => {
    const bar = toggleBar()
    const b = buttonCenter(bar, 1)
    expect(bar.itemAt(b.x, b.y)).toBe(ITEMS[1])
    // Padding, the gap between buttons, and the label row are not buttons.
    expect(bar.itemAt(bar.view.x + 2, b.y)).toBeNull()
    expect(bar.itemAt(bar.view.x + 8 + 56 + 2, b.y)).toBeNull()
    expect(bar.itemAt(b.x, bar.view.y + 2)).toBeNull()
    expect(bar.itemAt(b.x, bar.view.y + 8 + 56 + 2)).toBeNull()
  })

  it("highlights the selected button", () => {
    const bar = toggleBar()
    expect(borderColor(bar, 0)).toBe(UI_BORDER_COLOR)
    bar.select("a")
    expect(borderColor(bar, 0)).toBe(UI_SELECTED_COLOR)
    expect(borderColor(bar, 1)).toBe(UI_BORDER_COLOR)
  })

  describe("toggle bar", () => {
    it("starts with nothing selected", () => {
      expect(toggleBar().selected).toBeNull()
    })

    it("clicking a button toggles its selection", () => {
      const bar = toggleBar()
      const b = buttonCenter(bar, 0)
      bar.click(b.x, b.y)
      expect(bar.selected).toBe("a")
      bar.click(bar.view.x + 1, bar.view.y + 1) // padding: no change
      expect(bar.selected).toBe("a")
      bar.click(b.x, b.y)
      expect(bar.selected).toBeNull()
    })

    it("hotkeys toggle items and Escape clears the selection", () => {
      const bar = toggleBar()
      expect(bar.keyDown("Escape")).toBe(false)
      expect(bar.keyDown("x")).toBe(false)
      expect(bar.keyDown("1")).toBe(true)
      expect(bar.selected).toBe("a")
      expect(bar.keyDown("Q")).toBe(true) // case-insensitive
      expect(bar.selected).toBe("b")
      expect(bar.keyDown("Escape")).toBe(true)
      expect(bar.selected).toBeNull()
    })
  })

  describe("non-toggle bar", () => {
    it("always keeps one item selected", () => {
      const bar = new ButtonBar(ITEMS, { toggle: false })
      expect(bar.selected).toBe("a")
      const b = buttonCenter(bar, 1)
      bar.click(b.x, b.y)
      bar.click(b.x, b.y)
      expect(bar.selected).toBe("b")
      expect(bar.keyDown("Escape")).toBe(false)
      expect(bar.selected).toBe("b")
    })
  })
})
