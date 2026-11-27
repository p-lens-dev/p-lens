import { compare, decimal, isNegative, isZero, parseDecimal, quotient, rounded, toPlainString, type Decimal } from "../decimal/decimal"
import { tokenKindOf, type PlayGameKind } from "../play/play"
import { RATE_PLACES, type WrittenRate } from "../valuation/valuation"
import type { SavingsPool } from "./parlor"

/**
 * The terms a corner of a parlor plays on, as its board states them: how many
 * tokens a sum of yen rents, how many tokens a sum of yen is exchanged for,
 * and how many tokens a replay pays out for how many taken off savings.
 * Different corners of one parlor — 4 yen, 1 yen, even two 1-yen corners —
 * have different terms, so they belong to a play, not to the parlor. All
 * whole numbers above zero.
 */
export interface PlayTerms {
  readonly rental: { readonly yen: number; readonly tokens: number }
  readonly exchange: { readonly tokens: number; readonly yen: number }
  readonly replay: { readonly paidOut: number; readonly deducted: number }
}

/**
 * How a corner's exchange is stated for each game, as a board and a player
 * say it: the tokens ¥100 takes, to the places each game says it to at the
 * fewest — pachinko's 28玉 or 27.5玉, pachislot's 5.1枚 or 5.15枚 — and to
 * as many as `RATE_PLACES` where a broker's fee leaves no shorter one:
 * 28玉 less 2% is 28.57143玉.
 */
const EXCHANGE_STATED: Readonly<Record<PlayGameKind, { readonly yen: number; readonly places: number }>> = {
  pachinko: { yen: 100, places: 1 },
  pachislot: { yen: 100, places: 2 },
}

const STATED_NUMBER = new RegExp(`^\\d+(\\.\\d{1,${String(RATE_PLACES)}})?$`)

/**
 * An exchange as stated for a game, read from its text — commas and wide
 * digits tidied before — as whole tokens for a sum: 5.15枚 for ¥100 is 515
 * for ¥10,000, 27.5玉 is 275 for ¥1,000, and 28.57143玉 2,857,143 for
 * ¥10,000,000. None where it is not a number above zero to at most
 * `RATE_PLACES` places.
 */
export const exchangeOfStated = (gameKind: PlayGameKind, typed: string): PlayTerms["exchange"] | undefined => {
  const { yen, places } = EXCHANGE_STATED[gameKind]
  if (!STATED_NUMBER.test(typed)) return undefined
  const [units = "", fraction = ""] = typed.split(".")
  const kept = Math.max(places, fraction.length)
  const scale = 10 ** kept
  const tokens = Number(units) * scale + Number(fraction.padEnd(kept, "0") || "0")
  return tokens > 0 ? { yen: yen * scale, tokens } : undefined
}

/**
 * The shortest statement of an exchange that reads back as a rate `holds`
 * takes for it: to the places the game states one to at the fewest, and
 * further only as far as it must, up to `RATE_PLACES` — 28 for 3.571429,
 * 28.57143 for 3.5 — or to them all where none does.
 */
const shortestStated = (gameKind: PlayGameKind, perStated: (places: number) => Decimal, holds: (rate: Decimal) => boolean): string => {
  const { places } = EXCHANGE_STATED[gameKind]
  const tried = Array.from({ length: RATE_PLACES - places + 1 }, (_, more) => toPlainString(perStated(places + more)))
  return tried.find((stated) => ((read) => read !== undefined && holds(exchangeRateOf({ exchange: read })))(exchangeOfStated(gameKind, stated))) ?? tried.at(-1) ?? ""
}

/** A rate as a game states an exchange, tokens for ¥100, as briefly as reads back as the rate to the places it is written to: 3.571429 is 28, 3.57 a hand wrote is 28 too, and 3.920000 is 25.510204. */
export const statedExchangeOfRate = (gameKind: PlayGameKind, written: WrittenRate): string =>
  shortestStated(gameKind, (places) => quotient(whole(EXCHANGE_STATED[gameKind].yen), written.rate, places), (rate) => compare(rounded(rate, Math.max(written.places, written.rate.places)), written.rate) === 0)

/** An exchange as stated for a game, however it is kept, as briefly as reads back as the same rate: 510 for ¥10,000 and 52 for ¥1,000 at pachislot are 5.1 and 5.2, 280 for ¥1,000 at pachinko 28, 275 27.5, and 140 for ¥490 28.57143. */
export const statedExchangeOf = (gameKind: PlayGameKind, exchange: PlayTerms["exchange"]): string =>
  shortestStated(gameKind, (places) => quotient(whole(exchange.tokens * EXCHANGE_STATED[gameKind].yen), whole(exchange.yen), places), (rate) => compare(rate, exchangeRateOf({ exchange })) === 0)

const greatestDivisor = (left: bigint, right: bigint): bigint => (right === 0n ? left : greatestDivisor(right, left % right))

/**
 * An exchange with a broker's fee taken off what it pays, a percentage
 * from nothing to below a hundred: the tokens stay what the board says and
 * the yen are what is left of them — 28玉 less 2% is 28 balls for ¥98,
 * kept as the smallest whole counts that say it. None for a fee below
 * nothing or of a hundred or more.
 */
export const exchangeLessFee = (exchange: PlayTerms["exchange"], feePercent: Decimal): PlayTerms["exchange"] | undefined => {
  const hundred = 100n * 10n ** BigInt(feePercent.places)
  const kept = hundred - feePercent.mantissa
  if (isNegative(feePercent) || kept <= 0n) return undefined
  const [yen, tokens] = [BigInt(exchange.yen) * kept, BigInt(exchange.tokens) * hundred]
  const divisor = greatestDivisor(yen, tokens)
  return { yen: Number(yen / divisor), tokens: Number(tokens / divisor) }
}

const whole = (value: number): Decimal => decimal(BigInt(value), 0)

/** Yen per token the corner exchanges at, as the journal writes a rate. */
export const exchangeRateOf = (terms: Pick<PlayTerms, "exchange">): Decimal => quotient(whole(terms.exchange.yen), whole(terms.exchange.tokens), RATE_PLACES)

/** The rental rates parlors advertise, in yen per token, dearest first, for each game. */
const TIERS: Readonly<Record<PlayGameKind, readonly number[]>> = {
  pachinko: [4, 2, 1, 0.5, 0.25, 0.2, 0.1],
  pachislot: [20, 10, 5, 2, 1, 0.5],
}

/**
 * A rate few parlors run, named only within a narrow band of its own, so
 * that the common rate beside it keeps its wide one: a rental from `rental`
 * up to below `rentalBelow` a token, and an exchange from `exchangeFrom` up
 * to its own rate.
 */
interface RareTier {
  readonly tier: number
  readonly rentalBelow: number
  readonly exchangeFrom: number
}

/** Pachislot's 8円: renting 111 to 125 medals for ¥1,000 and exchanging 125 to 142; anything else around it is 10円's or 5円's. */
const RARE_TIERS: Readonly<Record<PlayGameKind, readonly RareTier[]>> = {
  pachinko: [],
  pachislot: [{ tier: 8, rentalBelow: 9, exchangeFrom: 7 }],
}

/** The rare rate a rental falls in the band of, where it does. */
const rareRented = (gameKind: PlayGameKind, terms: Pick<PlayTerms, "rental">): RareTier | undefined => {
  const rate = terms.rental.yen / terms.rental.tokens
  return RARE_TIERS[gameKind].find((rare) => rate >= rare.tier - SLACK && rate < rare.rentalBelow - SLACK)
}

/** Rates are compared with room for the float a division leaves: 1000 / 250 is 4, not 3.9999…. */
const SLACK = 1e-9

/**
 * The advertised rate a corner rents at, as a number, read off the rental
 * however it is written. A parlor rents at the advertised rate or dearer —
 * 1000 yen for 890 balls is 1.12 a ball at a 1-yen corner — so the rate is
 * the dearest advertised one not above it.
 */
const rentalTier = (gameKind: PlayGameKind, terms: Pick<PlayTerms, "rental">): number | undefined => {
  const rate = terms.rental.yen / terms.rental.tokens
  return rareRented(gameKind, terms)?.tier ?? TIERS[gameKind].find((tier) => tier <= rate + SLACK)
}

/**
 * The advertised rate a corner's exchange belongs to. A parlor exchanges at
 * the advertised rate or cheaper — 280 balls for 1000 yen is 3.57 a ball at a
 * 4-yen corner — so the rate is the cheapest advertised one not below it.
 * A rare rate is never one an exchange alone points to.
 */
const exchangeTier = (gameKind: PlayGameKind, terms: Pick<PlayTerms, "exchange">): number | undefined => {
  const rate = terms.exchange.yen / terms.exchange.tokens
  return TIERS[gameKind].toReversed().find((tier) => tier >= rate - SLACK)
}

const GAME_SHORT: Readonly<Record<PlayGameKind, string>> = { pachinko: "パチ", pachislot: "スロ" }

/**
 * A corner as a player calls it — `4円パチ`, `20円スロ` — by the dearest
 * rate it rents at or above, whatever it exchanges at and whichever parlor
 * it is: what a press of its buttons adds is kept under it. A play on no
 * terms, or below every rate, is at a rate unknown.
 */
export const cornerOf = (gameKind: PlayGameKind, terms: PlayTerms | undefined): string => {
  const rate = terms === undefined ? undefined : rentalTier(gameKind, terms)
  return `${rate === undefined ? UNKNOWN_TIER : `${String(rate)}円`}${GAME_SHORT[gameKind]}`
}

/** What a corner is called when its rental and exchange do not point to one advertised rate. */
export const UNKNOWN_TIER = "レート不明"

/**
 * The advertised rate a corner plays at, as the journal names it — `4円`,
 * `1円`, `20円` — when its rental and its exchange point to the same one.
 * A 4-yen rental exchanged at more than 4 yen, or a 1-yen one at 3.57, points
 * to none, and is kept as a rate unknown rather than guessed at. A rare
 * rate is named only where both fall in its narrow band.
 */
export const tierOf = (gameKind: PlayGameKind, terms: PlayTerms): string => {
  const rare = rareRented(gameKind, terms)
  if (rare !== undefined) {
    const exchanged = terms.exchange.yen / terms.exchange.tokens
    return exchanged >= rare.exchangeFrom - SLACK && exchanged <= rare.tier + SLACK ? `${String(rare.tier)}円` : UNKNOWN_TIER
  }
  const rented = rentalTier(gameKind, terms)
  return rented !== undefined && rented === exchangeTier(gameKind, terms) ? `${String(rented)}円` : UNKNOWN_TIER
}

const tierNamed = (tier: number | undefined): string => (tier === undefined ? UNKNOWN_TIER : `${String(tier)}円`)

/** The advertised rate a rental alone points to, as the journal names it — `4円`, `20円` — or a rate unknown. */
export const tierOfRental = (gameKind: PlayGameKind, rental: PlayTerms["rental"]): string => tierNamed(rentalTier(gameKind, { rental }))

/** The advertised rate an exchange alone points to, as the journal names it, or a rate unknown. */
export const tierOfExchange = (gameKind: PlayGameKind, exchange: PlayTerms["exchange"]): string => tierNamed(exchangeTier(gameKind, { exchange }))

/** What renting a token costs on these terms, in yen to six places. */
export const rentalPriceOf = (terms: Pick<PlayTerms, "rental">): Decimal => quotient(whole(terms.rental.yen), whole(terms.rental.tokens), RATE_PLACES)

/** What renting a token costs at the rate a tier names — 4 at `4円`, 0.5 at `0.5円` — and nothing where it names none, as a rate unknown does. */
export const rentalPriceOfTier = (tier: string): Decimal | undefined => {
  const named = tier.endsWith("円") ? parseDecimal(tier.slice(0, -1)) : undefined
  return named?.ok === true && !isZero(named.value) && !isNegative(named.value) ? named.value : undefined
}

/** The savings a play on these terms draws on and pays into. */
export const poolOf = (gameKind: PlayGameKind, terms: PlayTerms): SavingsPool => ({ kind: tokenKindOf(gameKind), tier: tierOf(gameKind, terms) })

/**
 * The pool savings at a corner of this exchange are kept in, by the
 * advertised rate the exchange belongs to alone, where the rental is not
 * asked: savings are never rented, and a person registering them knows
 * the exchange their counter gives, not the rental of a corner they may
 * not be playing.
 */
export const poolOfExchange = (gameKind: PlayGameKind, exchange: PlayTerms["exchange"]): SavingsPool => ({ kind: tokenKindOf(gameKind), tier: tierOfExchange(gameKind, exchange) })

/** Yen a token is worth on these terms, for the theoretical value a formula gives. */
export const tokenValueOf = (terms: PlayTerms): number => Number(toPlainString(exchangeRateOf(terms)))

/** Tokens a sum of yen rents, rounded down: a parlor never lends part of a ball. */
export const tokensRentedFor = (terms: Pick<PlayTerms, "rental">, yen: number): number => Math.floor((yen * terms.rental.tokens) / terms.rental.yen)

/** Savings a replay of so many tokens takes, rounded up: the fee is never in the player's favour. */
export const savingsDeductedFor = (terms: Pick<PlayTerms, "replay">, paidOut: number): number => Math.ceil((paidOut * terms.replay.deducted) / terms.replay.paidOut)
