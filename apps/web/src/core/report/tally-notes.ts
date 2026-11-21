import type { Transaction } from "../../hledger/protocol/wire"
import { SECONDS } from "../commodity/commodity"
import { parseDecimal, sum, type Decimal } from "../decimal/decimal"
import { ACCOUNTS } from "../journal/accounts"
import { asideOf } from "../tally/aside"
import { TALLY_TAGS, type TallyAside } from "../tally/tally"
import { userMemoIn } from "../tally/user-memo"
import { quantityIn } from "./figures"

/**
 * What a tally's entry says of its play beside its figures, each where it
 * says it: when it began and finished, its spin performance and who sent
 * it, the seconds it lasted, the jackpots and tokens carried in that were
 * told of it, the spins, games, ATs and bonuses counted of it, each as its
 * own tag says it whether or not the others are there, the note the
 * person wrote of it, and the terms an inferred theoretical value was
 * weighed on. Read as written, for whoever takes a book's tallies whole,
 * as a table does.
 */
export interface TallyNotes {
  readonly aside: TallyAside
  readonly playSeconds: Decimal | undefined
  readonly netJackpots: number | undefined
  readonly netSpins: number | undefined
  readonly netRegularSpins: number | undefined
  readonly netGames: number | undefined
  readonly netAts: number | undefined
  readonly netBonuses: number | undefined
  readonly userMemo: string | undefined
  readonly carriedIn: Decimal | undefined
  readonly inferredFormula: string | undefined
  readonly tokenRental: Decimal | undefined
  readonly tokenExchange: Decimal | undefined
  readonly inferredSpinPerformance: Decimal | undefined
}

const taggedIn =
  (transaction: Transaction) =>
  (name: string): string | undefined => {
    const value = transaction.ttags.find(([tag]) => tag === name)?.[1].trim()
    return value === "" ? undefined : value
  }

const amountOf = (text: string | undefined): Decimal | undefined => ((read) => (read?.ok === true ? read.value : undefined))(text === undefined ? undefined : parseDecimal(text))

const countOf = (text: string | undefined): number | undefined => (text !== undefined && /^\d+$/.test(text) ? Number(text) : undefined)

/** The seconds an entry put to play time, or none where it put nothing there. */
const playSecondsOf = (transaction: Transaction): Decimal | undefined => {
  const postings = transaction.tpostings.filter((posting) => posting.paccount === ACCOUNTS.playTime)
  return postings.length === 0 ? undefined : sum(postings.map((posting) => quantityIn(posting.pamount, SECONDS)))
}

/** What a tally's entry says of its play beside its figures. */
export const tallyNotesOf = (transaction: Transaction): TallyNotes => {
  const tagged = taggedIn(transaction)
  return {
    aside: asideOf(tagged),
    playSeconds: playSecondsOf(transaction),
    netJackpots: countOf(tagged(TALLY_TAGS.netJackpots)),
    netSpins: countOf(tagged(TALLY_TAGS.netSpins)),
    netRegularSpins: countOf(tagged(TALLY_TAGS.netRegularSpins)),
    netGames: countOf(tagged(TALLY_TAGS.netGames)),
    netAts: countOf(tagged(TALLY_TAGS.netAts)),
    netBonuses: countOf(tagged(TALLY_TAGS.netBonuses)),
    userMemo: userMemoIn(transaction.ttags),
    carriedIn: amountOf(tagged(TALLY_TAGS.carriedIn)),
    inferredFormula: tagged(TALLY_TAGS.inferredFormula),
    tokenRental: amountOf(tagged(TALLY_TAGS.tokenRental)),
    tokenExchange: amountOf(tagged(TALLY_TAGS.tokenExchange)),
    inferredSpinPerformance: amountOf(tagged(TALLY_TAGS.inferredSpinPerformance)),
  }
}
