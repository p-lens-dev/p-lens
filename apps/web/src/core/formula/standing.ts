/**
 * What people have done with a formula. Each mark is a different thing
 * said, by a different kind of player, and is counted and weighed after
 * what it says (`scoreOf`):
 *
 * - `verifications` and `refutations` (検証OK, 検証NG) — what a person
 *   found for themselves: they went through the basis, and it held or it
 *   did not. The professional's mark, and nobody else is being told
 *   anything. A finding is a fact, so it weighs the most, it is one each
 *   way a person a formula, and it is never taken back: whoever finds
 *   otherwise later gives the other, and the two cancel.
 * - `adoptions` and `rejections` (イチオシ, 非推奨) — what a person says to
 *   others: "go by this one", "keep off this one". The light player's and
 *   the semi-pro's mark. Talk is light, and a mind may change, so it
 *   weighs a fifth of a finding and is put on and taken off freely. The
 *   two are not a pair: an adoption is a choice, one formula a machine,
 *   moved by choosing another; a rejection is a warning, one a formula,
 *   as many as deserve it. A person may hold both on one formula.
 * - `uses` — plays started with it. Nobody says anything: a statistic,
 *   counted every time, weighing next to nothing a play and never past
 *   its most, and less for a formula made before its machine was
 *   published whole.
 * - `favorites` (お気に入り) — what a person keeps for themselves, in their
 *   book. It chooses the formula their own play opens with and ranks
 *   nothing.
 *
 * A machine's favourite is a different thing again and never counted here.
 */
export interface Standing {
  readonly verifications: number
  readonly refutations: number
  readonly adoptions: number
  readonly rejections: number
  readonly favorites: number
  readonly uses: number
}

/**
 * What a person has done with a formula: adopted it, rejected it, found
 * its basis good, found it wanting — each on its own, none letting go of
 * another. They are kept in the person's book (`core/marks`), so every
 * device the book reaches shows them. A favourite is not among them: it
 * is the book's own (`core/favorites`).
 */
export interface MyMarks {
  readonly adopted: boolean
  readonly rejected: boolean
  readonly verified: boolean
  readonly refuted: boolean
}

export type Mark = "adoption" | "rejection" | "verification" | "refutation" | "favorite"

/** A mark a person puts on and takes off: what they say to others, which a change of mind may unsay. */
export type HeldMark = Extract<Mark, "adoption" | "rejection">

/** A check either way: what was found, given once and standing from then on. */
export type CheckMark = Extract<Mark, "verification" | "refutation">

export const isHeld = (mine: MyMarks, mark: HeldMark): boolean => {
  switch (mark) {
    case "adoption":
      return mine.adopted
    case "rejection":
      return mine.rejected
  }
}

/** Checks that held, less those that did not. */
export const netVerifications = (standing: Standing): number => standing.verifications - standing.refutations

/** Adoptions, less rejections. */
export const netAdoptions = (standing: Standing): number => standing.adoptions - standing.rejections

/**
 * Anything people register for a machine and stand behind the way they do a
 * formula: a pachinko 算出条件, a pachislot one, a pachislot 設定配分. Ranked
 * by its game's tier, then by the score of how it was made and what has
 * been done with it, then by age (`ranked`).
 */
export interface Ranked {
  readonly id: string
  readonly createdAt: string
  /** How a formula was made; a 設定配分 is made no way, and has none. */
  readonly kind?: Making
  /** The one it was remade from, where it was: a fork when that one is of the same machine. */
  readonly derivedFrom: string | undefined
}

/** How a formula was made: typed in, worked out exactly from a basis, or sampled from one by the simulator. */
export type Making = "manual" | "simulated" | "sampled"

export interface FormulaListing<F extends Ranked> {
  readonly formula: F
  readonly standing: Standing
}

/**
 * What a formula makes a play worth, as a number to set two formulas of a
 * machine against each other: a harsher formula's is lower. Its game says
 * what it is — a pachinko formula's balls a spin, a pachislot one's 機械割.
 */
export type Worth<F> = (formula: F) => number

/**
 * How a game sets a machine's listings against each other beside what
 * people have done with them:
 *
 * - `tier` — what ranks before any score, a higher tier first: a pachislot
 *   formula's power to tell setting levels apart, one refuted more than
 *   verified below them all; one tier for all where the game has none.
 * - `details` — the kinds of detail a listing fills, for what a fork adds
 *   over the one it was remade from; none where the game says it in its
 *   tier instead.
 * - `stagesPassed` — the days, already past, on which a maker publishes
 *   more of a machine (小役確率 a week after release, モード移行率 a month,
 *   詳細な設定差 three): the uses of a listing made before each count half.
 *   None where a machine is published whole at once.
 * - `worth` — what it makes a play worth, between two made at once.
 */
export interface Measure<F extends Ranked> {
  readonly tier: (listing: FormulaListing<F>) => number
  readonly details: (formula: F) => ReadonlySet<string>
  readonly stagesPassed: readonly string[]
  readonly worth: Worth<F>
}

/**
 * What a check, an adoption and a use each weigh in a formula's score, in
 * hundredths of a point so the sum is a whole number and two scores are
 * equal exactly or not at all:
 *
 * | mark                  | what it is                | points | counted                    | taken back |
 * |-----------------------|---------------------------|--------|----------------------------|------------|
 * | 検証OK / 検証NG       | found for oneself         | ±10    | one each a person a formula | never      |
 * | イチオシ / 非推奨     | said to others            | ±2     | one a machine / one a formula | freely   |
 * | 利用                  | a play started, a statistic | +0.01 | every time, to a most      | —          |
 * | お気に入り            | kept for oneself          | 0      | —                          | freely     |
 *
 * The weight follows the mark's nature. What was found is heavy and
 * stands; what is said is light and may be unsaid. A check and an
 * adoption are one a person, so nobody lifts a formula further by
 * pressing again; a use is not, which is why it weighs a hundredth.
 */
const WEIGHTS = { verification: 1_000, adoption: 200, use: 1 } as const

/**
 * The most a formula's uses weigh, however many they are: a hundredth
 * short of sixteen points. A formula long played with has earned its
 * place — it was not sifted out — but plays alone, counted every time and
 * fed by whichever formula a machine opens with, never weigh more than
 * being worked out from a basis does.
 */
const MOST_FROM_USES = 1_599

/** Whether a formula's uses weigh their most in its score already, so that more of them lift it no further. */
export const usesWeighTheirMost = (standing: Standing): boolean => standing.uses * WEIGHTS.use >= MOST_FROM_USES

/**
 * What being a fork weighs — remade from a formula of the same machine,
 * most likely to put it right or to say more: an adoption's two points,
 * whether or not the one it was remade from is still listed, for a
 * formula put aside for its remake is hidden. A copy from another machine
 * is no fork; it derives from nothing. A fork remade in turn gives its
 * weight up to the one remade from it, so the newest of a line of remakes
 * is the one lifted.
 */
const FORK_BONUS = 200

/** What each kind of detail a fork fills that the one it was remade from left empty weighs, and the most they weigh together. */
const FILLED_DETAIL = 100
const MOST_FROM_FILLED = 500

/**
 * What a formula's making weighs in its score before anyone has done
 * anything with it, in the same hundredths: one worked out from a basis
 * sixteen points, one sampled by the simulator thirteen, and one typed in
 * nothing. What is worked out from a basis is exact where what is sampled
 * is an estimate, and typed figures are taken on trust. A sampled one is a
 * point more than all its maker can give one typed in: whoever makes a
 * formula may adopt it and check it, twelve points, so their own marks
 * never lift one typed in over one sampled, and one more person's
 * adoption does, over one nobody marked.
 */
const MAKING_WEIGHTS: Readonly<Record<Making, number>> = { manual: 0, sampled: 1_300, simulated: 1_600 }

/**
 * A formula's score from its making and its marks:
 *
 *     making + (検証OK − 検証NG) × 10 + (イチオシ − 非推奨) × 2 + min(利用 × 0.01, 15.99)
 *
 * in points, kept in hundredths. Each term is what one kind of evidence
 * says: how the formula was made, what people found for themselves, what
 * they tell each other, and how much it is played. One formula's many
 * adoptions can outweigh another's one check; a formula refuted as often
 * as it was verified has nothing from its checks, and one refuted more
 * goes below zero. Eight rejections outweigh all that uses can ever give.
 * Favourites weigh nothing. Its rank adds to it what its machine's other
 * listings and its game say (`rankScoreOf`).
 */
export const scoreOf = <F extends Ranked>(listing: FormulaListing<F>): number =>
  (listing.formula.kind === undefined ? 0 : MAKING_WEIGHTS[listing.formula.kind]) +
  netVerifications(listing.standing) * WEIGHTS.verification +
  netAdoptions(listing.standing) * WEIGHTS.adoption +
  Math.min(listing.standing.uses * WEIGHTS.use, MOST_FROM_USES)

/** The stages of publication a formula was made before, of those passed. */
const stagesMissed = (formula: Ranked, stagesPassed: readonly string[]): number => stagesPassed.filter((stage) => formula.createdAt.slice(0, 10) < stage).length

/** What a formula's uses weigh in its rank: their weight in its score, halved for each stage of publication it was made before. */
const usesInRank = <F extends Ranked>(listing: FormulaListing<F>, stagesPassed: readonly string[]): number =>
  Math.floor(Math.min(listing.standing.uses * WEIGHTS.use, MOST_FROM_USES) / 2 ** stagesMissed(listing.formula, stagesPassed))

/** What each kind of detail a fork fills that the one it was remade from left empty weighs, where that one is listed to be set against. */
const filledWeight = <F extends Ranked>(formula: F, parent: F | undefined, measure: Measure<F>): number => {
  if (parent === undefined) return 0
  const before = measure.details(parent)
  return Math.min([...measure.details(formula)].filter((detail) => !before.has(detail)).length * FILLED_DETAIL, MOST_FROM_FILLED)
}

/** What being a fork weighs: the bonus, and the detail it fills; nothing where it derives from nothing, or was itself remade among the listings. */
const forkWeight = <F extends Ranked>(formula: F, among: readonly FormulaListing<F>[], measure: Measure<F>): number => {
  if (formula.derivedFrom === undefined || among.some((other) => other.formula.derivedFrom === formula.id)) return 0
  return FORK_BONUS + filledWeight(formula, among.find((other) => other.formula.id === formula.derivedFrom)?.formula, measure)
}

/** A listing's score in its machine's rank: its score with its uses halved by the stages it missed, and what being a fork weighs. */
export const rankScoreOf = <F extends Ranked>(listing: FormulaListing<F>, among: readonly FormulaListing<F>[], measure: Measure<F>): number =>
  scoreOf(listing) - Math.min(listing.standing.uses * WEIGHTS.use, MOST_FROM_USES) + usesInRank(listing, measure.stagesPassed) + forkWeight(listing.formula, among, measure)

/**
 * A machine's listings in rank: the higher tier first, then the higher
 * score in rank. Between two of the same, the newer: a formula made since
 * was most likely made to put the older right or to say more, and nobody
 * has yet said otherwise. Between two made at once, the one that makes a
 * play worth less, the harsher figures being the safer to go by, and then
 * by id, so the order never shuffles.
 */
export const ranked = <F extends Ranked>(listings: readonly FormulaListing<F>[], measure: Measure<F>): readonly FormulaListing<F>[] =>
  listings
    .map((listing) => ({ listing, tier: measure.tier(listing), score: rankScoreOf(listing, listings, measure) }))
    .toSorted(
      (left, right) =>
        right.tier - left.tier ||
        right.score - left.score ||
        right.listing.formula.createdAt.localeCompare(left.listing.formula.createdAt) ||
        measure.worth(left.listing.formula) - measure.worth(right.listing.formula) ||
        left.listing.formula.id.localeCompare(right.listing.formula.id),
    )
    .map((each) => each.listing)

/**
 * Which formula a machine opens with, and why: the one a book of the
 * person's keeps as its favourite, or else the best ranked. Shown with its reason, so a
 * favourite chosen for you never passes for the machine's recommendation.
 */
export type Selection<F extends Ranked> =
  | { readonly by: "favorite"; readonly listing: FormulaListing<F> }
  | { readonly by: "ranking"; readonly listing: FormulaListing<F> }
  | { readonly by: "person"; readonly listing: FormulaListing<F> }

export const autoSelect = <F extends Ranked>(listings: readonly FormulaListing<F>[], measure: Measure<F>, favorites: ReadonlySet<string>): Selection<F> | undefined => {
  const order = ranked(listings, measure)
  const favorite = order.find((listing) => favorites.has(listing.formula.id))
  const best = order.at(0)
  return favorite !== undefined ? { by: "favorite", listing: favorite } : best === undefined ? undefined : { by: "ranking", listing: best }
}

/**
 * The formula chosen by hand from a machine's listings, when the address
 * names one it has.
 */
export const selectById = <F extends Ranked>(listings: readonly FormulaListing<F>[], id: string): Selection<F> | undefined => {
  const chosen = listings.find((listing) => listing.formula.id === id)
  return chosen === undefined ? undefined : { by: "person", listing: chosen }
}

