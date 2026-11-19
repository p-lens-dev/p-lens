import { daysAfter, type IsoDate } from "../calendar/calendar"
import { netVerifications, type FormulaListing, type Measure } from "../formula/standing"
import { discriminationGradeOf, discriminationOf, type DiscriminationGrade } from "./discrimination"
import { worthOf, type Formula, type SettingDistribution } from "./formula"

/**
 * The days after a machine's release by which its maker has published more
 * of it, each with some days to spare: 小役確率 a week on, 内部モードの特徴
 * two, モード移行率 a month, 特定条件でのAT当選率 two, 詳細な設定差 three.
 */
const PUBLICATION_STAGE_DAYS: readonly number[] = [10, 21, 40, 70, 100]

/** The stages of a machine's publication passed by a moment, an ISO time. */
const stagesPassedOf = (releasedOn: IsoDate, now: string): readonly string[] =>
  PUBLICATION_STAGE_DAYS.map((days) => daysAfter(releasedOn, days)).filter((stage) => stage <= now.slice(0, 10))

const GRADE_TIERS: Readonly<Record<DiscriminationGrade, number>> = { S: 4, A: 3, B: 2, C: 1 }

/** A formula's grade of discrimination, from what its counter counts. */
export const gradeOf = (formula: Formula): DiscriminationGrade => discriminationGradeOf(discriminationOf(formula.basis.normalized, formula.figures))

/** A formula's tier: its grade of discrimination, one refuted more than verified below every grade, its figures being said to be wrong. */
const tierOf = (listing: FormulaListing<Formula>): number => (netVerifications(listing.standing) < 0 ? 0 : GRADE_TIERS[gradeOf(listing.formula)])

const NO_DETAILS: ReadonlySet<string> = new Set()

/**
 * How a machine's formulas are set against each other beside their marks:
 * by the grade of their power to tell setting levels apart — what a fork
 * fills shows there — and every use made before a stage of the machine's
 * publication passed by `now` counting half.
 */
export const measureOf = (releasedOn: IsoDate, now: string): Measure<Formula> => ({
  tier: tierOf,
  details: () => NO_DETAILS,
  stagesPassed: stagesPassedOf(releasedOn, now),
  worth: worthOf,
})

/** How a machine's 設定配分 are set against each other: by their marks, in one tier, a use made before a stage of publication counting half. */
export const distributionMeasureOf = (releasedOn: IsoDate, now: string): Measure<SettingDistribution> => ({
  tier: () => 0,
  details: () => NO_DETAILS,
  stagesPassed: stagesPassedOf(releasedOn, now),
  worth: () => 0,
})
