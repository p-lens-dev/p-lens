import type { Checkpoint } from "../play-log/checkpoint"
import { daySeenOf } from "./observation"
import type { FormulaSnapshot } from "./snapshot"
import { counterBonusesOf, counterBonusOf, type Countable } from "./weighing"

/**
 * The bonus a bonus machine's play has just won: the first of its formula's
 * bonuses the day has more of at the log's last line than at the line
 * before it. Nothing on an AT machine, whose AT is told as an event of its
 * own, and nothing before the play has a line past its first.
 */
export const lastBonusWonOf = (ordered: readonly Checkpoint[], formula: FormulaSnapshot): Countable | undefined => {
  if (formula.normalized.atRules !== undefined || ordered.length < 2) return undefined
  const shownAs = counterBonusOf(formula.normalized)
  const before = daySeenOf(ordered.slice(0, -1), shownAs)?.bonuses ?? {}
  const now = daySeenOf(ordered, shownAs)?.bonuses ?? {}
  return counterBonusesOf(formula).find((bonus) => (now[bonus.id] ?? 0) > (before[bonus.id] ?? 0))
}
