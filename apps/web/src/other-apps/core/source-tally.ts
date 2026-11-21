import type { IsoDate } from "../../core/calendar/calendar"
import type { Decimal } from "../../core/decimal/decimal"
import { describedBy, writableText, type Entry, type Posting } from "../../core/journal/entry"
import { identityTags, type Parlor, type ParlorId } from "../../core/parlor/parlor"
import { clockTags, clockText } from "../../core/tally/clock"
import { toldTags } from "../../core/tally/compose"
import { SOURCE_TAGS } from "../../core/tally/source-tags"
import { userTagCutOf } from "../../core/tally/user-tags"
import { TALLY_TAGS, type InferredWorth, type PlayClock, type TallyTold } from "../../core/tally/tally"
import type { PlayGameKind, PlayId } from "../../core/play/play"
import { sidePostings } from "../../core/tally/sides"
import { inferredTheoreticalValuePosting, theoreticalValuePosting } from "../../core/theoretical/theoretical"

/**
 * A tally as another app kept it, read out of what that app wrote: the day,
 * where and on what as that app names them, what went in and what came
 * back in yen, and a note. Its names are the other app's, with the codes
 * that app knows them by — none of them yet a parlor of the parlor list or
 * a machine of the catalog — and so are its labels, which are the other
 * app's own and none of this app's.
 */
export interface SourceTally {
  readonly date: IsoDate
  readonly parlor: { readonly name: string; readonly code: string }
  readonly machine: { readonly name: string; readonly code: string; readonly maker: string }
  readonly cabinetNumber: string
  readonly outlay: Decimal
  readonly takings: Decimal
  readonly memo: string
  /** How long it lasted, in hours, where that app said. */
  readonly hours: Decimal | undefined
  /** When it began and finished, each where that app said. */
  readonly clock: PlayClock | undefined
  /** What it was worth, in yen, where that app kept a figure the person gave it, and not one it made up of the result. */
  readonly theoreticalValue: Decimal | undefined
  /** Which game it was, where that app said. */
  readonly gameKind: PlayGameKind | undefined
  /** Every spin that app counted the person playing from the seat, where it did: a pachislot play's games, as that app counts them under the same name. */
  readonly countedSpins: number | undefined
  /** A pachinko play's regular games alone that app counted — none of a 確変, 時短 or 残保留 — as パチフォリオ's 回転数 is taken to be, where it did: a pachislot play's games where it counted no spins beside them. */
  readonly countedRegularSpins: number | undefined
  /** The jackpots that app counted the person winning, where it did: a pachislot play's ATs, as that app counts them under the same name. */
  readonly countedJackpots: number | undefined
  /** The bonuses that app counted a pachislot play winning, where it did: a pachinko play's jackpots where it counted no jackpots beside them. */
  readonly countedBonuses: number | undefined
  /** The parlor of the parlor list it was at, where the file says, as this app's own 汎用形式 writes it: never another app's code for a parlor. */
  readonly parlorId: ParlorId | undefined
  /** The words that app let a person label it with, as that app kept them, and none of this app's. */
  readonly sourceLabels: readonly string[]
}

/** A machine of the catalog that a source's machine is, where its name is one's and only one game's. */
export interface MatchedMachine {
  readonly name: string
  readonly gameKind: PlayGameKind
}

/** A tally taken in from another app, ready to be written: the tally as that app kept it, where it came from, the id it goes by here, the catalog's machine where its name matched one, and the book's parlor where the file named one the book has. */
export interface ImportedTally {
  readonly id: PlayId
  /** The app it came from, as a word of its own: `precord`. */
  readonly from: string
  readonly source: SourceTally
  readonly machine: MatchedMachine | undefined
  readonly parlor: Parlor | undefined
  /** What it was taken to be worth from its hours and its two sides, where it was weighed. */
  readonly inferred: InferredWorth | undefined
}

/** What an imported tally tells of its play beside its two sides: its hours, where the other app said them, and what it was taken to be worth from them, where it was weighed and the other app gave no theoretical value. */
const toldOf = (tally: ImportedTally): TallyTold | undefined =>
  tally.source.hours === undefined ? undefined : { hours: tally.source.hours, netJackpots: undefined, inferred: tally.source.theoreticalValue === undefined ? tally.inferred : undefined }

/** A note as a comment under the entry can hold it: a colon would make a tag of the word before it. */
const noteOf = (memo: string): string => writableText(memo).replaceAll(":", "：")

const tagged = (name: string, value: string): readonly (readonly [string, string])[] => (writableText(value) === "" ? [] : [[name, writableText(value)]])

const cabinetOf = (source: SourceTally): string => [source.machine.name, source.cabinetNumber.trim() === "" ? "" : `${source.cabinetNumber.trim()}番台`].map(writableText).filter((part) => part !== "").join(" ")

/** The game an imported tally is written as: its machine's, where the catalog has it, or else the one the other app said. */
const gameKindOf = (tally: ImportedTally): PlayGameKind | undefined => tally.machine?.gameKind ?? tally.source.gameKind

const counted = (name: string, count: number | undefined): readonly (readonly [string, string])[] => (count === undefined ? [] : [[name, String(count)]])

/**
 * The spins, jackpots and bonuses the other app counted of a tally's play,
 * as this app's own: a pachinko play's net spins, net regular spins and net
 * jackpots — its bonuses where that app counted no jackpots — and a
 * pachislot play's net games — its regular games where that app counted no
 * spins — net ATs and net bonuses; none where neither game is known, there
 * being no telling which they are.
 */
const countedTags = (tally: ImportedTally): readonly (readonly [string, string])[] => {
  const { countedSpins, countedRegularSpins, countedJackpots, countedBonuses } = tally.source
  switch (gameKindOf(tally)) {
    case "pachinko":
      return [...counted(TALLY_TAGS.netSpins, countedSpins), ...counted(TALLY_TAGS.netRegularSpins, countedRegularSpins), ...counted(TALLY_TAGS.netJackpots, countedJackpots ?? countedBonuses)]
    case "pachislot":
      return [...counted(TALLY_TAGS.netGames, countedSpins ?? countedRegularSpins), ...counted(TALLY_TAGS.netAts, countedJackpots), ...counted(TALLY_TAGS.netBonuses, countedBonuses)]
    case undefined:
      return []
  }
}

/** An imported tally's description: the book's parlor it is tied to, or else the parlor as the other app named it, for the payee, its machine and cabinet for the note. */
const describe = (tally: ImportedTally): string => describedBy(tally.parlor?.name ?? writableText(tally.source.parlor.name), cabinetOf(tally.source))

/** What an imported tally was worth: the theoretical value the other app gave, or else what it was taken to be worth where it was weighed. */
const worthPostings = (tally: ImportedTally): readonly Posting[] => {
  if (tally.source.theoreticalValue !== undefined) return [theoreticalValuePosting(tally.source.theoreticalValue)]
  return tally.inferred === undefined || tally.source.hours === undefined ? [] : [inferredTheoreticalValuePosting(tally.inferred.value)]
}

/**
 * An imported tally as one journal entry, in yen alone, its two sides as a
 * tally typed in by hand has them (`sidePostings`): a loss out of cash, a
 * gain into the special prizes, never into cash — with its hours where
 * the other app said them, its clock where it said that, and its
 * theoretical value where it gave one — or else what it was taken to be
 * worth from its hours where it was weighed — as a tally typed in by hand
 * has those too. Its
 * description is the tally as the other app named it; `machine` is
 * written only where the catalog has the machine, `game-kind` where it
 * has or the other app said which game it was, and a parlor is named
 * only where it is tied to one of the book's.
 */
export const importedTallyEntry = (tally: ImportedTally): Entry => ({
  date: tally.source.date,
  description: describe(tally),
  tags: [
    [TALLY_TAGS.playId, tally.id],
    ...((gameKind) => (gameKind === undefined ? [] : [[TALLY_TAGS.gameKind, gameKind] as const]))(gameKindOf(tally)),
    ...(tally.machine === undefined ? [] : [[TALLY_TAGS.machine, tally.machine.name] as const]),
    ...(tally.parlor === undefined ? [] : identityTags(tally.parlor.identity)),
    ...tagged(TALLY_TAGS.cabinetNumber, tally.source.cabinetNumber),
    [SOURCE_TAGS.from, tally.from],
    ...tagged(SOURCE_TAGS.parlor, tally.source.parlor.name),
    ...tagged(SOURCE_TAGS.parlorCode, tally.source.parlor.code),
    ...tagged(SOURCE_TAGS.machine, tally.source.machine.name),
    ...tagged(SOURCE_TAGS.machineCode, tally.source.machine.code),
    ...tagged(SOURCE_TAGS.maker, tally.source.machine.maker),
    ...countedTags(tally),
    ...[...new Set(tally.source.sourceLabels.map(userTagCutOf))].flatMap((label) => tagged(SOURCE_TAGS.label, label)),
    ...toldTags(toldOf(tally)),
    ...clockTags(tally.source.clock),
  ],
  postings: [...sidePostings(tally.source.outlay, tally.source.takings), ...worthPostings(tally)],
  notes: noteOf(tally.source.memo) === "" ? [] : [noteOf(tally.source.memo)],
})

const FNV_OFFSET = 0x811c9dc5

const FNV_PRIME = 0x01000193

/** A text as eight hex digits that the same text always gives: FNV-1a, over its UTF-16 units. */
const digest = (text: string): string =>
  [...text]
    .reduce((hash, character) => Math.imul(hash ^ character.charCodeAt(0), FNV_PRIME) >>> 0, FNV_OFFSET)
    .toString(16)
    .padStart(8, "0")

/** What a source says beyond pRecord's first columns, as one text; empty where it says none of it, as a pRecord tally with no 種別 does. */
const beyondOf = (source: SourceTally): string =>
  source.gameKind === undefined && source.countedSpins === undefined && source.countedRegularSpins === undefined && source.countedJackpots === undefined && source.sourceLabels.length === 0
    ? ""
    : [source.gameKind ?? "", source.countedSpins ?? source.countedRegularSpins ?? "", source.countedJackpots ?? "", ...source.sourceLabels].join("\u001e")

/** What a source says beyond that again, as one text: regular spins counted beside every spin, bonuses and the listed parlor; empty where it says none of it, as no app's tallies did before 汎用形式 wrote them. */
const furthestOf = (source: SourceTally): string =>
  (source.countedSpins === undefined || source.countedRegularSpins === undefined) && source.countedBonuses === undefined && source.parlorId === undefined
    ? ""
    : [source.countedSpins === undefined ? "" : (source.countedRegularSpins ?? ""), source.countedBonuses ?? "", source.parlorId ?? ""].join("\u001e")

const decimalText = (amount: Decimal): string => `${amount.mantissa}e-${amount.places}`

/** What a source says of its clock and its theoretical value, as one text; empty where it says neither, as no app's tallies did before マネクルSP's. */
const furtherOf = (source: SourceTally): string =>
  source.clock === undefined && source.theoreticalValue === undefined
    ? ""
    : [source.clock?.started === undefined ? "" : clockText(source.clock.started), source.clock?.finished === undefined ? "" : clockText(source.clock.finished), source.theoreticalValue === undefined ? "" : decimalText(source.theoreticalValue)].join("\u001e")

const saidOnly = (text: string): readonly string[] => (text === "" ? [] : [text])

/** Everything a source's tally says, as one text: what pRecord's columns say, and what it says beyond them only where it does, so that a tally of an app that says less goes by the id it always has. */
const sameAs = (source: SourceTally): string =>
  [source.date, source.parlor.code, source.parlor.name, source.machine.code, source.machine.name, source.cabinetNumber, decimalText(source.outlay), decimalText(source.takings), source.memo, ...saidOnly(beyondOf(source)), ...saidOnly(furtherOf(source)), ...saidOnly(furthestOf(source))].join("\u001f")

/**
 * The ids a file's tallies go by here, in the file's order: where each came
 * from, its day, and a digest of everything it says — so the same file
 * taken in again gives the same ids, and what the book already has is left
 * alone. Two tallies that say exactly the same are told apart by their order,
 * each counted against those like it before it as the file is gone over once.
 */
export const importedIdsOf = (from: string, sources: readonly SourceTally[]): readonly PlayId[] =>
  sources.reduce<{ readonly ids: PlayId[]; readonly seen: Map<string, number> }>(
    (built, source) => {
      const key = sameAs(source)
      const earlier = built.seen.get(key) ?? 0
      built.seen.set(key, earlier + 1)
      built.ids.push(`${from}-${source.date.replaceAll("-", "")}-${digest(key)}${earlier === 0 ? "" : `-${earlier + 1}`}` as PlayId)
      return built
    },
    { ids: [], seen: new Map() },
  ).ids
