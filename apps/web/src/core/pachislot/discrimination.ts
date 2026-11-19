import type { NormalizedSpecDto, TableDto, WatchDto } from "@p-lens/contracts/pachislot"

import type { SettingLevelFigures } from "./figures"

/** The regular games of a day at the cabinet, which a formula's power to tell setting levels apart is reckoned over. */
const DAY_GAMES = 8_000

const mean = (values: readonly number[]): number => (values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length)

/** How far one spread of outcomes is from another: what each outcome seen tells the first from the second, on average, in nats. */
const divergence = (from: readonly number[], to: readonly number[]): number =>
  from.reduce((sum, share, index) => (share > 0 && (to[index] ?? 0) > 0 ? sum + share * Math.log(share / (to[index] ?? 1)) : sum), 0)

/** Outcomes that need not cover a trial, with what is left of it as one more: nothing among them came up. */
const withNothing = (shares: readonly number[]): readonly number[] => [...shares, Math.max(0, 1 - shares.reduce((sum, share) => sum + share, 0))]

/** The lower and the upper half of a formula's setting levels, by their tables: 1–3 and 4–6 of six, the middle one of an odd count in neither. */
const halvesOf = (tables: readonly TableDto[]): { readonly low: readonly TableDto[]; readonly high: readonly TableDto[] } => {
  const half = Math.floor(tables.length / 2)
  return { low: tables.slice(0, half), high: tables.slice(tables.length - half) }
}

/** What a regular game's countable outcomes, counted together, tell the upper half from the lower, a game. */
const gamesTell = (low: readonly TableDto[], high: readonly TableDto[]): number => {
  const ids = (low[0]?.events ?? []).map((event) => event.id)
  if (ids.length === 0) return 0
  const spread = (tables: readonly TableDto[]): readonly number[] => withNothing(ids.map((id) => mean(tables.map((table) => table.events.find((event) => event.id === id)?.chance ?? 0))))
  return divergence(spread(high), spread(low))
}

/**
 * How often a watch's trials come a regular game: a bonus's chance times
 * the trials each gives, or, over a moment — counted by hand, with no
 * chance of its own — once for each first hit, as a CZ missed or an AT
 * ended would.
 */
const trialsAGame = (watch: WatchDto, tables: readonly TableDto[], firstHit: number): number => {
  const over = watch.bonus === undefined ? firstHit : mean(tables.map((table) => table.events.filter((event) => event.id === watch.bonus || event.group === watch.bonus).reduce((sum, event) => sum + event.chance, 0)))
  return over * watch.trials
}

/** What one watch's cues tell the upper half from the lower, a regular game. */
const watchTells = (watch: WatchDto, low: readonly TableDto[], high: readonly TableDto[], all: readonly TableDto[], firstHit: number): number => {
  const ids = (all[0]?.cues ?? []).filter((cue) => cue.watch === watch.id).map((cue) => cue.id)
  const spread = (tables: readonly TableDto[]): readonly number[] => {
    const shares = ids.map((id) => mean(tables.map((table) => table.cues?.find((cue) => cue.id === id)?.chance ?? 0)))
    return watch.whole ? shares : withNothing(shares)
  }
  return divergence(spread(high), spread(low)) * trialsAGame(watch, all, firstHit)
}

/**
 * A formula's power to tell a high setting level from a low one by what
 * its counter counts: what a day of regular games counted tells the upper
 * half of its setting levels from the lower, in nats — `e` to it is how
 * many times likelier the right half comes to look. Small wins and bonuses
 * count by their chance a game; cues by their chance a trial and the
 * trials a day. Signs, whose chances nobody gives, and the formula's own
 * first hits, which every formula of a machine shares, count for nothing.
 */
export const discriminationOf = (normalized: NormalizedSpecDto, figures: readonly Pick<SettingLevelFigures, "combinedOneIn">[]): number => {
  const tables = normalized.tables
  const { low, high } = halvesOf(tables)
  if (low.length === 0) return 0
  const firstHit = mean(figures.map((each) => 1 / each.combinedOneIn))
  const watches = (normalized.watches ?? []).reduce((sum, watch) => sum + watchTells(watch, low, high, tables, firstHit), 0)
  return (gamesTell(low, high) + watches) * DAY_GAMES
}

/**
 * A formula's power to tell setting levels apart in points out of a
 * hundred, as a list shows it: what is left of the doubt a day of counting
 * clears, `100 × (1 − e^−discrimination)`. It never passes a hundred, so a
 * formula whose moments are reckoned to come more often than they do reads
 * high, never wild.
 */
export const discriminationPointsOf = (discrimination: number): number => Math.round(100 * (1 - Math.exp(-discrimination)))

/**
 * A formula's grade of discrimination, the tier it ranks in, by its points:
 * S from 85, A from 70, B from 50, C from 30, D from 10, E below — a formula
 * that counts nothing, or signs alone, is E.
 */
export type DiscriminationGrade = "S" | "A" | "B" | "C" | "D" | "E"

const GRADE_POINTS: readonly { readonly grade: DiscriminationGrade; readonly points: number }[] = [
  { grade: "S", points: 85 },
  { grade: "A", points: 70 },
  { grade: "B", points: 50 },
  { grade: "C", points: 30 },
  { grade: "D", points: 10 },
]

export const discriminationGradeOf = (discrimination: number): DiscriminationGrade =>
  GRADE_POINTS.find((each) => discriminationPointsOf(discrimination) >= each.points)?.grade ?? "E"
