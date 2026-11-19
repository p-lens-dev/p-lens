import type { Measure } from "../formula/standing"
import { basisOf, worthOf, type Formula } from "./formula"

/** The kinds of detail a formula's basis fills: the components it gives anything in, by name, a label being none; none where it has no basis. */
const detailsOf = (formula: Formula): ReadonlySet<string> =>
  new Set(
    Object.entries(basisOf(formula)?.spec.components ?? {})
      .filter(([name, table]) => name !== "label" && Object.keys(table ?? {}).length > 0)
      .map(([name]) => name),
  )

/**
 * How a machine's formulas are set against each other beside their marks:
 * in one tier, a fork weighed by the detail it fills, and every use counted
 * whole — a machine is published whole at its release, its setting levels,
 * where it has them, each a formula of its own.
 */
export const measure: Measure<Formula> = { tier: () => 0, details: detailsOf, stagesPassed: [], worth: worthOf }
