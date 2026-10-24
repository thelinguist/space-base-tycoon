import { Container, Graphics, Text } from "pixi.js"
import { AssetName, makeSprite } from "../assets"
import {
  UI_BORDER_COLOR,
  UI_BUTTON_COLOR,
  UI_PANEL_COLOR,
  UI_SELECTED_COLOR,
  UI_TEXT_COLOR,
} from "../constants/color"

export interface BarItem<T> {
  id: T
  icon: AssetName
  label: string
  /** KeyboardEvent.key that selects this item (case-insensitive). */
  hotkey: string
}

export interface BarOptions {
  /**
   * Clicking the selected item again, or pressing Escape, deselects it.
   * Without this the bar always keeps one item selected.
   */
  toggle: boolean
}

// Layout in screen pixels. Everything sits on whole pixels with square
// corners and hard 2px borders to keep the pixel-art look.
const BUTTON_SIZE = 56
const ICON_SIZE = 40
const LABEL_HEIGHT = 14
const PADDING = 8
const GAP = 8
const BORDER = 2

const TEXT_STYLE = {
  fontFamily: "monospace",
  fontSize: 10,
  fontWeight: "bold",
  fill: UI_TEXT_COLOR,
} as const

interface Button<T> {
  item: BarItem<T>
  frame: Graphics
  /** Left edge relative to the panel. */
  x: number
}

/**
 * A screen-space panel of selectable icon buttons. Hit-testing uses the
 * fixed layout above (not Pixi bounds) so the Game can route pointer
 * events to it with plain screen coordinates.
 */
export class ButtonBar<T> {
  readonly view = new Container()
  readonly width: number
  readonly height = PADDING * 2 + BUTTON_SIZE + LABEL_HEIGHT
  selected: T | null

  private readonly buttons: Button<T>[]

  constructor(
    readonly items: BarItem<T>[],
    readonly options: BarOptions,
  ) {
    this.selected = options.toggle ? null : items[0].id
    this.width =
      PADDING * 2 + items.length * BUTTON_SIZE + (items.length - 1) * GAP

    const panel = new Graphics()
      .rect(0, 0, this.width, this.height)
      .fill(UI_PANEL_COLOR)
      .rect(0, 0, this.width, this.height)
      .stroke({ color: UI_BORDER_COLOR, width: BORDER, alignment: 1 })
    this.view.addChild(panel)

    this.buttons = items.map((item, i) => {
      const x = PADDING + i * (BUTTON_SIZE + GAP)
      const frame = new Graphics()
      frame.position.set(x, PADDING)

      const icon = makeSprite(item.icon)
      icon.anchor.set(0.5)
      icon.scale.set(
        ICON_SIZE / Math.max(icon.texture.width, icon.texture.height),
      )
      icon.position.set(x + BUTTON_SIZE / 2, PADDING + BUTTON_SIZE / 2)

      const hotkey = new Text({
        text: item.hotkey.toUpperCase(),
        style: TEXT_STYLE,
      })
      hotkey.position.set(x + BORDER + 2, PADDING + BORDER + 1)

      const label = new Text({ text: item.label, style: TEXT_STYLE })
      label.anchor.set(0.5, 0)
      label.position.set(x + BUTTON_SIZE / 2, PADDING + BUTTON_SIZE + 2)

      this.view.addChild(frame, icon, hotkey, label)
      return { item, frame, x }
    })
    this.redraw()
  }

  /** Place the panel's top-left corner at a screen position. */
  moveTo(x: number, y: number): void {
    this.view.position.set(Math.round(x), Math.round(y))
  }

  /** Whether a screen point is over the panel (and so not the map). */
  contains(sx: number, sy: number): boolean {
    const x = sx - this.view.x
    const y = sy - this.view.y
    return x >= 0 && y >= 0 && x < this.width && y < this.height
  }

  /** The item under a screen point, if any. */
  itemAt(sx: number, sy: number): BarItem<T> | null {
    const y = sy - this.view.y - PADDING
    if (y < 0 || y >= BUTTON_SIZE) return null
    const x = sx - this.view.x
    const hit = this.buttons.find((b) => x >= b.x && x < b.x + BUTTON_SIZE)
    return hit?.item ?? null
  }

  /** Select an item, or clear the selection with null. */
  select(id: T | null): void {
    this.selected = id
    this.redraw()
  }

  /** Choose an item; on a toggle bar, choosing it again deselects it. */
  choose(id: T): void {
    this.select(this.options.toggle && this.selected === id ? null : id)
  }

  click(sx: number, sy: number): void {
    const item = this.itemAt(sx, sy)
    if (item) this.choose(item.id)
  }

  /** Handle a key press; returns whether the bar used it. */
  keyDown(key: string): boolean {
    if (key === "Escape" && this.options.toggle && this.selected !== null) {
      this.select(null)
      return true
    }
    const lower = key.toLowerCase()
    const item = this.items.find((i) => i.hotkey.toLowerCase() === lower)
    if (item) this.choose(item.id)
    return item !== undefined
  }

  private redraw(): void {
    for (const { item, frame } of this.buttons) {
      const active = item.id === this.selected
      frame
        .clear()
        .rect(0, 0, BUTTON_SIZE, BUTTON_SIZE)
        .fill(UI_BUTTON_COLOR)
        .rect(0, 0, BUTTON_SIZE, BUTTON_SIZE)
        .stroke({
          color: active ? UI_SELECTED_COLOR : UI_BORDER_COLOR,
          width: BORDER,
          alignment: 1,
        })
    }
  }
}
