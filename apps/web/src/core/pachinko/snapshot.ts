import { supportDriftOf, type Formula, type FormulaId, type FormulaKind } from "./formula"
import type { Figures } from "./figures"
import type { MachineId } from "../machine/machine"

/**
 * What a play carries of its machine and formula: enough to work out its
 * theoretical value offline, for as long as the play lasts, whatever happens to
 * the catalog meanwhile.
 */
export interface FormulaSnapshot {
  readonly id: FormulaId
  readonly machineId: MachineId
  readonly kind: FormulaKind
  readonly figures: Figures
  /**
   * 電サポ中の増減 as its basis says, in hundredths of a ball a spin — `-30`
   * is 0.3 of a ball lost — left out where it says none or has no basis:
   * what a play's measuring sets the drift a person counted against.
   */
  readonly supportDrift?: number
  /**
   * The spins a first jackpot's combo plays at the heso on average — a CZ
   * after a bonus, say — as the engine solved them, left out where it plays
   * none: what a play's measuring counts as played at the heso after each
   * jackpot won in regular games, which a person writes as a 時短.
   */
  readonly paidSpins?: number
}

export const snapshotOf = (formula: Formula): FormulaSnapshot => ({
  id: formula.id,
  machineId: formula.machineId,
  kind: formula.kind,
  figures: formula.figures,
  ...((hundredths) => (hundredths === 0 ? {} : { supportDrift: hundredths }))(supportDriftOf(formula)),
})
