import { jackpotCountingOf } from "../live-play/draft"
import type { Play } from "../live-play/draft-reading"
import type { HuddleEntry, HuddlePlay } from "./post"
import { parsePlayLog, type Checkpoint } from "../play-log/checkpoint"
import { EVERY_JACKPOT, liveSummary } from "../play-log/live"
import { inPlayOrder } from "../play-log/performance"
import * as Pachislot from "../pachislot"
import type { PlayGameKind } from "../play/play"

/**
 * Where one of the others' plays stands, as its log last says: over, in a
 * jackpot — an AT won, on a pachislot AT machine, or a pachinko run still
 * in 確変 — in 時短, as its bar was switched to it, a bonus just won on a
 * pachislot bonus machine — by its label, on the line of the log it was
 * read on, counting from the first, so that one won on the next line is
 * another — or being played.
 */
export type HuddleStanding =
  | { readonly type: "finished" }
  | { readonly type: "jackpot" }
  | { readonly type: "rapid" }
  | { readonly type: "bonus"; readonly bonus: string; readonly line: number }
  | { readonly type: "playing" }

const bonusWonOf = (play: Play, ordered: readonly Checkpoint[]): HuddleStanding => {
  const won = play.gameKind === "pachislot" && play.pachislot !== undefined ? Pachislot.lastBonusWonOf(ordered, play.pachislot.formula) : undefined
  return won === undefined ? { type: "playing" } : { type: "bonus", bonus: won.label, line: ordered.length }
}

export const huddleStandingOf = (play: Play): HuddleStanding => {
  const read = parsePlayLog(play.log)
  if (!read.ok) return { type: "playing" }
  if (read.value.some((checkpoint) => checkpoint.event?.kind === "finished")) return { type: "finished" }
  const ordered = inPlayOrder(read.value)
  const last = ordered.at(-1)
  if (last?.event?.kind === "jackpot") return { type: "jackpot" }
  return last?.event?.kind === "rapid-began" ? { type: "rapid" } : bonusWonOf(play, ordered)
}

/** Whether a reading was of regular games: no jackpot or other event on it, and, on a pachinko play, not in 時短 or 確変. */
const isRegular = (checkpoint: Checkpoint): boolean => checkpoint.event === undefined && (checkpoint.phase === undefined || checkpoint.phase === "regular")

/**
 * How many jackpots one of the others' plays has won in a row: those since
 * its last reading of regular games, however many readings in 時短 came
 * between them, each counted as its cabinet's counter counts it — the
 * 連チャン a parlor's counter shows. Nought where none followed it.
 */
export const jackpotStreakOf = (play: Play): number => {
  const read = parsePlayLog(play.log)
  if (!read.ok) return 0
  const ordered = inPlayOrder(read.value)
  const since = ordered.findLastIndex(isRegular)
  return liveSummary(ordered.slice(since + 1), play.gameKind === "pachinko" ? jackpotCountingOf(play) : EVERY_JACKPOT).jackpots
}

/** The others' plays in a jackpot: each the one its player is on, while they are still in the huddle. */
const inJackpot = (plays: readonly HuddlePlay[]): readonly HuddlePlay[] => plays.filter((shown) => shown.latest && !shown.departed && huddleStandingOf(shown.post.play).type === "jackpot")

/** The game of each of the others in a jackpot now, those who have said nothing for long left out — theirs is likely over by now: what the room wears on the rail. */
export const othersInJackpot = (plays: readonly HuddlePlay[], idle: ReadonlySet<string>): readonly PlayGameKind[] =>
  inJackpot(plays)
    .filter((shown) => !idle.has(shown.post.member))
    .map((shown) => shown.post.play.gameKind)

/** How long a member says nothing before the others are told so, in milliseconds: a play is shown as its log changes, and an hour and a half without a reading is a long while at a cabinet. */
export const IDLE_AFTER = 90 * 60_000

/**
 * The members who have put nothing on the line for `IDLE_AFTER` up to a
 * moment, in milliseconds: no play shown, taken back or left. It says
 * nothing is being typed in, not that nobody is playing — a long run
 * may go untyped — so it is said as 動きなし, never as having left.
 */
export const idleMembers = (entries: readonly HuddleEntry[], now: number): ReadonlySet<string> => {
  const lastSaid = entries.reduce((latest, entry) => ((said) => (said !== undefined && said >= entry.postedAt ? latest : new Map(latest).set(entry.member, entry.postedAt)))(latest.get(entry.member)), new Map<string, string>())
  return new Set([...lastSaid].filter(([, said]) => now - Date.parse(said) >= IDLE_AFTER).map(([member]) => member))
}

/** Who of the others still in the huddle has won on the play they are on, each by their member and play, and a bonus by the line it was won on too: a jackpot as long as it goes on, a bonus only on the line that read it. */
const winnersOf = (plays: readonly HuddlePlay[]): readonly string[] =>
  plays
    .filter((shown) => shown.latest && !shown.departed)
    .flatMap((shown) => ((standing) => (standing.type === "jackpot" ? [`${shown.post.member} ${shown.post.play.id}`] : standing.type === "bonus" ? [`${shown.post.member} ${shown.post.play.id} ${standing.line}`] : []))(huddleStandingOf(shown.post.play)))

/**
 * Who of the others still in the huddle has won on the play they are on,
 * as one word — each one's member and play, in order — the same for the
 * same people in the same wins: it changes as one of them wins a jackpot
 * or a bonus, or one's ends, and not while a jackpot goes on.
 */
export const wonNow = (plays: readonly HuddlePlay[]): string => winnersOf(plays).toSorted().join("\n")

/**
 * How the huddle's game turned between who had won and who has now: one
 * won a jackpot or a bonus — from regular games, or one more beside
 * another's — or only wins that went on ended; nothing where it did not
 * turn.
 */
export type HuddleTurn = "won" | "ended"

const rosterOf = (won: string): ReadonlySet<string> => new Set(won === "" ? [] : won.split("\n"))

export const huddleTurnOf = (before: string, now: string): HuddleTurn | undefined => {
  if (before === now) return undefined
  const was = rosterOf(before)
  return [...rosterOf(now)].some((who) => !was.has(who)) ? "won" : "ended"
}

/** A turn seen on top of one not yet looked at: a win stays the louder until the list is looked at. */
export const louderTurn = (so: HuddleTurn | undefined, now: HuddleTurn | undefined): HuddleTurn | undefined => (so === "won" || now === "won" ? "won" : (now ?? so))
