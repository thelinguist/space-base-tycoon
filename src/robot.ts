import { UnitType } from "./assets"
import { ROBOT_BLUE_COLOR, ROBOT_YELLOW_COLOR } from "./constants/color"
import { Point } from "./iso"
import { ToolType } from "./tools"
import { Walker } from "./walker"

/** Movement speed in tiles per second. */
const SPEED = 3

export interface RobotKind {
  asset: UnitType
  label: string
  /** KeyboardEvent.key that selects this robot. */
  hotkey: string
  /** Selection ring color. */
  color: number
}

export const ROBOT_KINDS: RobotKind[] = [
  { asset: "robot", label: "YELLOW", hotkey: "q", color: ROBOT_YELLOW_COLOR },
  { asset: "robotBlue", label: "BLUE", hotkey: "w", color: ROBOT_BLUE_COLOR },
]

/** A player-directed builder robot. */
export class Robot extends Walker {
  /** Where the player sent this robot, until it arrives. */
  goal: Point | null = null
  /** Used on each tile the robot stops on, if set. */
  tool: ToolType | null = null

  constructor(
    tx: number,
    ty: number,
    readonly kind: RobotKind = ROBOT_KINDS[0],
  ) {
    super(kind.asset, tx, ty, SPEED)
  }
}
