import { toPlainString, type Decimal } from "../../core/decimal/decimal"
import { readTokenCommodity, type TokenKind } from "../../core/commodity/commodity"
import type { BookFiles } from "../../core/journal/layout"
import { rentalPriceOf, rentalPriceOfTier, statedExchangeOf, statedExchangeOfRate, tierOf, type PlayTerms } from "../../core/parlor/terms"
import { termsInHead } from "../../core/play-log/head"
import { playLogPath } from "../../core/play-log/checkpoint"
import type { PlayGameKind, PlayId } from "../../core/play/play"
import type { TallyLine } from "../../core/report/tally-line"
import { clockText } from "../../core/tally/clock"
import { rateOn, rateReachingBack, type PricePoint, type WrittenRate } from "../../core/valuation/valuation"

/**
 * The table's columns, as its first row names them. They are the file's
 * format, as the account names are the journal's: whoever opens the file
 * reads these words, so a column keeps its name. They go in the order a
 * person reads a tally in — where and on what rate, what was played, what
 * it came to, how it went, then what was weighed, what the person said of
 * it, and where it came from — and 汎用形式's import offers its fields in
 * the same order.
 */
const COLUMNS = [
  "営業日",
  "店舗",
  "種別",
  "レート",
  "貸玉単価",
  "交換率",
  "機種",
  "メーカー",
  "台番号",
  "投資",
  "回収",
  "収支",
  "期待値",
  "実質ボーダー",
  "回転率",
  "回転数",
  "通常回転数",
  "ゲーム数",
  "大当り回数",
  "AT回数",
  "ボーナス回数",
  "開始時刻",
  "終了時刻",
  "稼働時間",
  "開始時の持ち玉・持ちメダル",
  "推定期待値",
  "推定の算出条件ID",
  "推定の貸玉単価",
  "推定の交換率",
  "推定の回転率",
  "摘要",
  "タグ",
  "メモ",
  "送り主",
  "送り主ID",
  "店舗ID",
  "稼働ID",
  "取込元",
] as const

const GAME_KINDS: Readonly<Record<PlayGameKind, string>> = { pachinko: "パチンコ", pachislot: "スロット" }

/** The game a kind of token is played at, which says how its exchange is stated. */
const GAME_OF_TOKEN: Readonly<Record<TokenKind, PlayGameKind>> = { ball: "pachinko", medal: "pachislot" }

/** What is not known is an empty cell, which a spreadsheet leaves out of a sum; a dash would be text in a column of numbers. */
const UNKNOWN = ""

const amountText = (amount: Decimal | undefined): string => (amount === undefined ? UNKNOWN : toPlainString(amount))

const countText = (count: number | undefined): string => (count === undefined ? UNKNOWN : String(count))

/** A tally's labels in one cell, as 汎用形式's import reads them back: `イベント,朝一`. */
const labelsText = (labels: readonly string[]): string => labels.join(",")

/** Seconds as hours and minutes, `5:20`, to the nearest minute: what a spreadsheet takes as a time, and what this app takes in as 稼働時間. */
const durationText = (seconds: Decimal | undefined): string => {
  if (seconds === undefined) return UNKNOWN
  const minutes = Math.round(Number(toPlainString(seconds)) / 60)
  return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")}`
}

/** The terms a tally's play was on, as its log says in its head; none for a tally with no log, or a log that says none. */
const termsOf = (files: BookFiles, line: TallyLine): PlayTerms | undefined => {
  const log = line.tally.gameKind === undefined ? undefined : files[playLogPath(line.tally.gameKind, line.tally.id)]
  const said = log === undefined ? undefined : termsInHead(log)
  return said?.type === "stated" ? said.terms : undefined
}

/** The rate the book sets a commodity at on a day, reaching back to the first it was given for a day before it had one. */
const bookRateOf = (prices: readonly PricePoint[], commodity: string, line: TallyLine): WrittenRate | undefined =>
  rateOn(prices, commodity, line.tally.date) ?? rateReachingBack(prices, commodity, line.tally.date)

/**
 * A tally's rate in three cells: the rate its tokens are named by, `4円`;
 * what renting one cost, in yen, as its play's log states it or else as
 * that rate names it; and its exchange as its game states it, tokens for
 * ¥100 — `28`, `5.1` — at the rate the book values its tokens at on its
 * day, or else as its play's log states it. A tally in yen with no log
 * says none.
 */
const rateCellsOf = (line: TallyLine, terms: PlayTerms | undefined, prices: readonly PricePoint[]): readonly string[] => {
  const token = line.tokenCommodity === undefined ? undefined : readTokenCommodity(line.tokenCommodity)
  const gameKind = token === undefined ? line.tally.gameKind : GAME_OF_TOKEN[token.kind]
  if (gameKind === undefined) return [UNKNOWN, UNKNOWN, UNKNOWN]
  const tier = token?.tier ?? (terms === undefined ? undefined : tierOf(gameKind, terms))
  const rental = terms === undefined ? (tier === undefined ? undefined : rentalPriceOfTier(tier)) : rentalPriceOf(terms)
  const rate = line.tokenCommodity === undefined ? undefined : bookRateOf(prices, line.tokenCommodity, line)
  const exchange = rate === undefined ? (terms === undefined ? UNKNOWN : statedExchangeOf(gameKind, terms.exchange)) : statedExchangeOfRate(gameKind, rate)
  return [tier ?? UNKNOWN, amountText(rental), exchange]
}

const rowOf = (line: TallyLine, terms: PlayTerms | undefined, prices: readonly PricePoint[], notes: ReadonlyMap<PlayId, string>): readonly string[] => [
  line.tally.date,
  line.parlorName ?? UNKNOWN,
  line.tally.gameKind === undefined ? UNKNOWN : GAME_KINDS[line.tally.gameKind],
  ...rateCellsOf(line, terms, prices),
  line.machineName ?? UNKNOWN,
  line.maker ?? UNKNOWN,
  line.tally.cabinetNumber ?? UNKNOWN,
  toPlainString(line.sides.spent),
  toPlainString(line.sides.won),
  toPlainString(line.actual),
  amountText(line.tally.theoreticalValue),
  amountText(line.notes.aside.realBorder),
  amountText(line.notes.aside.spinPerformance),
  countText(line.notes.netSpins),
  countText(line.notes.netRegularSpins),
  countText(line.notes.netGames),
  countText(line.notes.netJackpots),
  countText(line.notes.netAts),
  countText(line.notes.netBonuses),
  line.notes.aside.clock?.started === undefined ? UNKNOWN : clockText(line.notes.aside.clock.started),
  line.notes.aside.clock?.finished === undefined ? UNKNOWN : clockText(line.notes.aside.clock.finished),
  durationText(line.notes.playSeconds),
  amountText(line.notes.carriedIn),
  amountText(line.tally.inferredValue),
  line.notes.inferredFormula ?? UNKNOWN,
  amountText(line.notes.tokenRental),
  amountText(line.notes.tokenExchange),
  amountText(line.notes.inferredSpinPerformance),
  line.tally.description,
  labelsText(line.labels),
  notes.get(line.tally.id) ?? UNKNOWN,
  line.notes.aside.sender?.name ?? UNKNOWN,
  line.notes.aside.sender?.id ?? UNKNOWN,
  line.tally.parlorId ?? UNKNOWN,
  line.tally.id,
  line.tally.importedFrom ?? UNKNOWN,
]

/** Tallies as a table, a tally a row under the row of column names, in the order given, each with its rate from its play's log among the book's files and the book's rates, and its memo from what the person said of it, by its play's id (`notesOf`). Amounts are plain numbers of yen, with no separators and no unit. */
export const tallyTableOf = (lines: readonly TallyLine[], files: BookFiles, prices: readonly PricePoint[], notes: ReadonlyMap<PlayId, string>): readonly (readonly string[])[] => [
  COLUMNS,
  ...lines.map((line) => rowOf(line, termsOf(files, line), prices, notes)),
]
