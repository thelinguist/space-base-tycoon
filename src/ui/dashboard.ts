import { Container } from "pixi.js"
import { BuildingType } from "../assets"
import { ROBOT_KINDS, RobotKind } from "../robot"
import { ToolType } from "../tools"
import { BarItem, ButtonBar } from "./buttonBar"

export const BUILD_ITEMS: BarItem<BuildingType>[] = [
  { id: "habitat", icon: "habitat", label: "HABITAT", hotkey: "1" },
  { id: "radar", icon: "radar", label: "RADAR", hotkey: "2" },
]

export const TOOL_ITEMS: BarItem<ToolType>[] = [
  { id: "terraform", icon: "terraform", label: "TERRA", hotkey: "t" },
]

/** Space between panels. */
const GAP = 16
/** Distance between the panels and the bottom of the screen. */
const MARGIN = 16

/**
 * The bottom-of-screen HUD: a robot selector (always one selected, by
 * index into the robot kinds), the selected robot's tool (optional), and
 * the build menu (optional).
 */
export class Dashboard {
  readonly view = new Container()
  readonly robots: ButtonBar<number>
  readonly tools = new ButtonBar(TOOL_ITEMS, { toggle: true })
  readonly build = new ButtonBar(BUILD_ITEMS, { toggle: true })

  constructor(robotKinds: RobotKind[] = ROBOT_KINDS) {
    this.robots = new ButtonBar(
      robotKinds.map((k, i) => ({
        id: i,
        icon: k.asset,
        label: k.label,
        hotkey: k.hotkey,
      })),
      { toggle: false },
    )
    this.view.addChild(this.robots.view, this.tools.view, this.build.view)
  }

  /** Index of the robot the player is controlling. */
  get selectedRobot(): number {
    // A non-toggle bar never deselects.
    return this.robots.selected!
  }

  private get bars(): ButtonBar<unknown>[] {
    return [this.robots, this.tools, this.build]
  }

  /** Center the panels side by side along the bottom of the screen. */
  layout(screenWidth: number, screenHeight: number): void {
    const bars = this.bars
    const width =
      bars.reduce((sum, b) => sum + b.width, 0) + GAP * (bars.length - 1)
    let x = Math.round((screenWidth - width) / 2)
    const y = screenHeight - this.robots.height - MARGIN
    for (const bar of bars) {
      bar.moveTo(x, y)
      x += bar.width + GAP
    }
  }

  /** Whether a screen point is over any panel (and so not the map). */
  contains(sx: number, sy: number): boolean {
    return this.bars.some((b) => b.contains(sx, sy))
  }

  click(sx: number, sy: number): void {
    for (const bar of this.bars) bar.click(sx, sy)
  }

  /** Escape clears the build selection first, then the tool. */
  keyDown(key: string): void {
    for (const bar of [this.build, this.tools, this.robots]) {
      if (bar.keyDown(key)) return
    }
  }
}
