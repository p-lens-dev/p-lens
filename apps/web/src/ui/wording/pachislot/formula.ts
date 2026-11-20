import type { SettingLevelFigures } from "../../../core/pachislot/figures"
import type { Formula, FormulaKind, SettingLevelShare } from "../../../core/pachislot/formula"
import { gradeOf } from "../../../core/pachislot/measure"
import type { Prior, StockSpreadKey } from "../../../core/pachislot/prior"
import type { TakeBackRefusal } from "../../../core/pachislot/path"
import type { CounterRefusal } from "../../../core/pachislot/reading"
import type { RevisionRefusal } from "../../../core/pachislot/revision"
import type { ReadingRefusal } from "../../../core/play-log/live"
import { formulaIdLabel } from "../catalog"
import { amountText, formatCount, signedAmountText, UNSEEN_THEORETICAL, type Amount } from "../numbers"
import { seal } from "../../../mummer"
import type { TriggerWords } from "./trigger"
import { settingLevelMark, settingLevelText } from "./setting-level"
import { discriminationGradeOf, discriminationPointsOf } from "../../../core/pachislot/discrimination"
import type { TappableKind } from "../../../core/pachislot/weighing"

const KIND_NAMES: Readonly<Record<FormulaKind, string>> = { manual: "手入力", simulated: "解析値から計算", sampled: "シミュレータ" }

export const kindName = (kind: FormulaKind): string => KIND_NAMES[kind]

/** Odds as an analysis sheet prints them: `1/273.1`, and `1/6.25` where one decimal would round a 小役 away. */
export const oddsText = (oneIn: number): string => (Number.isFinite(oneIn) ? `1/${oneIn.toFixed(oneIn < 10 ? 2 : 1)}` : "--")

/**
 * What a pachislot formula is known by: its 機械割 from the lowest setting
 * level to the highest — `機械割 97.0%〜109.4%` — since nobody names one.
 */
export const formulaText = (figures: readonly SettingLevelFigures[]): string => `機械割 ${payoutRangeText(figures)}`

/** 機械割 from the lowest setting level to the highest, `97.0%〜109.4%`, one figure where they are the same, dashes where there are none. */
const payoutRangeText = (figures: readonly SettingLevelFigures[]): string => {
  const rates = figures.map((each) => each.payoutRate)
  const [lowest, highest] = [Math.min(...rates), Math.max(...rates)]
  if (rates.length === 0) return "--"
  return lowest === highest ? payoutRateText(lowest) : `${payoutRateText(lowest)}〜${payoutRateText(highest)}`
}

type Said = { readonly id: string; readonly figures: readonly SettingLevelFigures[] }

/** A pachislot formula as a box to choose one shows it: what its counter tells first, then its 機械割 — `判別力S・機械割97.8%〜114.3%`. */
export const formulaChoiceText = (formula: Formula): string => `判別力${gradeOf(formula)}・機械割${payoutRangeText(formula.figures)}`

/** The same among its machine's, with its id where another says the same. */
export const formulaChoiceAmong = (formula: Formula, among: readonly Formula[]): string => {
  const shown = formulaChoiceText(formula)
  return among.filter((other) => formulaChoiceText(other) === shown).length > 1 ? `${shown}（${formulaIdLabel(formula.id)}）` : shown
}

/** A pachislot formula as it is passed on — "use this one": its 機械割, which says what it is, then its id, which finds it. */
export const formulaHandle = (formula: Said): string => `${formulaText(formula.figures)}・${formulaIdLabel(formula.id)}`

/** A 設定配分's shares, the levels it gives any: `設定1 60%・設定6 10%`. */
export const sharesText = (shares: readonly SettingLevelShare[]): string =>
  shares
    .filter((share) => share.basisPoints > 0)
    .map((share) => `${settingLevelText(share.settingLevel)} ${share.basisPoints / 100}%`)
    .join("・")

/** Figures nothing is known of yet, each as dashes in the shape it would have. */
export const UNSEEN = { share: "--.-%", averageSettingLevel: "設定-.--", settingLevel: "設定-", payoutRate: "---.-%", medalsPerGame: "-.---枚", medals: "--枚", games: "--G", yen: UNSEEN_THEORETICAL } as const

/** 機械割 as players write it: `1.055` is `105.5%`. */
export const payoutRateText = (ratio: number): string => `${(ratio * 100).toFixed(1)}%`

/** A chance as a share: `0.372` is `37.2%`. */
export const shareText = (probability: number): string => `${(probability * 100).toFixed(1)}%`

/** 期待設定, to two places as players quote it: `設定3.22`. */
export const averageSettingLevelText = (settingLevel: number): string => `設定${settingLevel.toFixed(2)}`

/** How often something came up so far, as a counter shows it: `1/5.9`, or `1/--` before it has. */
export const observedOneInText = (games: number, count: number): string => (count > 0 && games > 0 ? `1/${(games / count).toFixed(games / count < 10 ? 2 : 1)}` : "1/--")

/** How large a share of the trials a count came to — a cue over a moment, 7 of 10 as 70.0% — or dashes while none was watched. */
export const observedShareText = (trials: number, count: number): string => (trials > 0 ? `${((count / trials) * 100).toFixed(1)}%` : "--%")

/** How long after its newest formula a machine is still marked as updated in a list, in days. */
const FRESH_DAYS = 30

const HOUR_MILLIS = 3_600_000

/** How long ago a formula came, where it came within the month: within the hour, so many hours, so many days; nothing past the month. */
const updatedText = (updatedAt: string | undefined, now: string): string => {
  if (updatedAt === undefined) return ""
  const hours = Math.floor((Date.parse(now) - Date.parse(updatedAt)) / HOUR_MILLIS)
  if (hours < 1) return "1時間以内更新・"
  if (hours < 24) return `${String(hours)}時間前更新・`
  const days = Math.floor(hours / 24)
  return days > FRESH_DAYS ? "" : `${String(days)}日前更新・`
}

/**
 * What a pachislot machine's line in a list says beside its release: the
 * grade of what its best counter tells — 判別力B, or dashes where it has no
 * formula — and, where a formula was registered for it in the last month,
 * how long ago, so a machine whose analysis has just grown stands out —
 * before the grade, which ends every line so the grades of a list stand in
 * one column: 5時間前更新・判別力B, 3日前更新・判別力B. The grade comes apart
 * from the words before it, for the line to set it a little off them.
 */
export const machineDiscriminationText = (
  discrimination: number | undefined,
  updatedAt: string | undefined,
  now: string,
): { readonly lead: string; readonly grade: string } => ({
  lead: `${updatedText(updatedAt, now)}判別力`,
  grade: discrimination === undefined ? "--" : discriminationGradeOf(discrimination),
})

/**
 * What a sign says of the setting, from the levels it may be seen under
 * among the machine's: 設定4以上濃厚, 設定6濃厚, 設定2否定, 偶数設定濃厚 —
 * or the levels themselves where it says none of those, 設定1・5・6濃厚.
 */
export const signMeaningText = (seenUnder: readonly number[], machineLevels: readonly number[]): string => {
  const levels = machineLevels.toSorted((left, right) => left - right)
  const seen = levels.filter((level) => seenUnder.includes(level))
  const lowest = seen.at(0)
  if (lowest === undefined) return "--"
  if (seen.length === 1) return `${settingLevelText(lowest)}濃厚`
  if (seen.length === levels.filter((level) => level >= lowest).length) return `${settingLevelText(lowest)}以上濃厚`
  if (seen.length === levels.length - 1) return `${settingLevelText(levels.find((level) => !seen.includes(level)))}否定`
  const ofParity = (parity: number): readonly number[] => levels.filter((level) => level > 0 && level % 2 === parity)
  if (seen.join() === ofParity(0).join()) return "偶数設定濃厚"
  if (seen.join() === ofParity(1).join()) return "奇数設定濃厚"
  return `設定${seen.map(settingLevelMark).join("・")}濃厚`
}

/** What each kind of tile on a formula's counter is called, where a formula's screen lists them: a cue over a bonus and one over a moment alike. */
export const TAPPABLE_KIND_NAMES: Readonly<Record<TappableKind, string>> = {
  game: "小役・ボーナス",
  moment: "出来事",
  "cue-of-bonus": "示唆",
  "cue-of-moment": "示唆",
  sign: "確定演出",
}

/** A formula's power to tell setting levels apart, as its list shows it: its grade and its points out of a hundred — 判別力 S（85点）. */
export const discriminationText = (discrimination: number): string => `判別力 ${discriminationGradeOf(discrimination)}（${String(discriminationPointsOf(discrimination))}点）`

/** What an even prior is called wherever a 設定配分 would be named. */
export const EVEN_PRIOR_NAME = "均等（全設定が同じ）"

/** What each stock spread is called: the kind of day it is a reading of, and how hard. */
export const STOCK_SPREAD_NAMES: Readonly<Record<StockSpreadKey, string>> = {
  collecting: "回収日（激辛）",
  "ordinary-harsh": "通常営業（辛め）",
  ordinary: "通常営業（標準）",
  "ordinary-kind": "通常営業（甘め）",
  "event-weak": "イベント日（弱め）",
  event: "イベント日（標準）",
  "event-strong": "イベント日（強め）",
  "new-machine": "新台導入週",
  "grand-opening": "グランドオープン",
  featured: "全台系・対象台",
}

/** A play's prior by name: the 設定配分's label, a stock spread's name, or an even spread. */
export const priorName = (prior: Prior): string => {
  if (prior.type === "distribution") return prior.label
  return prior.type === "stock" ? STOCK_SPREAD_NAMES[prior.key] : EVEN_PRIOR_NAME
}

/** Theoretical medals a game gains or loses, to three places: `+0.108枚`. */
export const medalsPerGameText = (medals: number): string => `${medals < 0 ? "-" : "+"}${Math.abs(medals).toFixed(3)}枚`

/** Theoretical medals in whole ones, signed: `+120枚`. */
export const signedMedalsText = (medals: Amount<number>): string => `${signedAmountText(medals)}枚`

/** Games or medals on average, in whole ones: `約412G`. */
export const aboutText = (value: number, unit: "G" | "枚"): string => `約${formatCount(Math.round(value))}${unit}`

/** Why an AT machine's reading cannot be kept as it stands. */
export const describeAtReadingRefusal = (refusal: ReadingRefusal): string => {
  switch (refusal.type) {
    case "counter-went-back":
      return `AT間のゲーム数は、少なくとも${formatCount(refusal.expectedAtLeast)}Gのはずです。記録していないATがあったなら、足して記録できます。`
    case "outlay-went-back":
      return `投資（累計）は、前に記録した¥${amountText(seal.play(refusal.atLeast))}より少なくはなりません。`
    case "replay-went-back":
      return `貯メダル（累計）は、前に記録した${amountText(seal.play(refusal.atLeast))}枚より少なくはなりません。`
    case "handed-beyond-hand":
      return handedBeyondText(refusal.held)
  }
}

/** Why medals handed away cannot be kept: more than the medals in hand, which then stood at so many. */
const handedBeyondText = (held: number): string => `持ちメダル（${amountText(seal.play(held))}枚）より多くは渡せません。渡したメダルの数か、持ちメダルを見直してください。`

/** What was to be taken back, in the words of the machine's trigger. */
const takenName = (taken: TakeBackRefusal["taken"], trigger: TriggerWords): string => {
  switch (taken) {
    case "at":
      return "AT当選"
    case "cz-missed":
      return trigger.missed
    case "bonus-missed":
      return trigger.bonusMissed ?? "ATなしボーナス"
  }
}

/** Why the last AT won or CZ missed was not taken back. */
export const describeTakeBackRefusal = (refusal: TakeBackRefusal, trigger: TriggerWords): string => {
  switch (refusal.type) {
    case "none":
      return `戻せる${takenName(refusal.taken, trigger)}がありません。`
    case "played-on":
      return `${takenName(refusal.taken, trigger)}のあとに記録があるので戻せません。上の履歴から直してください。`
  }
}

export const describeCounterRefusal = (refusal: CounterRefusal, bonusLabel: (id: string) => string): string => {
  switch (refusal.type) {
    case "bonus-went-back":
      return `${bonusLabel(refusal.id)}の回数は、前に記録した${formatCount(refusal.atLeast)}回より少なくはなりません。`
    case "total-went-back":
      return `累計ゲーム数は、少なくとも${formatCount(refusal.atLeast)}Gのはずです。データカウンターを読み直してください。`
    case "outlay-went-back":
      return `投資（累計）は、前に記録した¥${amountText(seal.play(refusal.atLeast))}より少なくはなりません。`
    case "replay-went-back":
      return `貯メダル（累計）は、前に記録した${amountText(seal.play(refusal.atLeast))}枚より少なくはなりません。`
    case "handed-beyond-hand":
      return handedBeyondText(refusal.held)
  }
}

/** Why a reading cannot be set right or taken away as asked: that a later record could not follow, and what it would need. */
export const describeStepRefusal = (refusal: RevisionRefusal, bonusLabel: (id: string) => string): string => {
  const where = "この変更だと、あとの記録と食い違います。"
  switch (refusal.type) {
    case "total-went-back":
      return `${where}累計ゲーム数が、少なくとも${formatCount(refusal.atLeast)}Gのはずになります。`
    case "bonus-went-back":
      return `${where}${bonusLabel(refusal.id)}の回数が、${formatCount(refusal.atLeast)}回より少なくなってしまいます。`
    case "counter-went-back":
      return `${where}AT間のゲーム数が、少なくとも${formatCount(refusal.expectedAtLeast)}Gのはずになります。`
    case "outlay-went-back":
      return `${where}投資（累計）が、¥${amountText(seal.play(refusal.atLeast))}より少なくなってしまいます。`
    case "replay-went-back":
      return `${where}貯メダル（累計）が、${amountText(seal.play(refusal.atLeast))}枚より少なくなってしまいます。`
    case "handed-beyond-hand":
      return `${where}渡したメダルが、その時の持ちメダル（${amountText(seal.play(refusal.held))}枚）より多くなってしまいます。`
  }
}

/** A bonus as a list of bonuses names it: by its name, or — until it is given one — by where it stands among the bonuses, ボーナス2. */
export const bonusTitle = (label: string, position: number): string => (label.trim() === "" ? `ボーナス${position}` : label.trim())

/** What is said while a formula too heavy for the shared catalog to check is sent again, with what this device solved. */
export const RESENDING = {
  title: "この端末の計算結果を添えて、送り直しています",
  note: "計算が重く、共有カタログでは検算しきれませんでした。この端末で解いた結果を一緒に送って、「検算なし」として登録します。",
} as const

/** What is said once such a formula is taken. */
export const SHARED_UNCHECKED = {
  title: "「検算なし」で登録しました",
  description: "共有カタログでは検算できなかったため、この端末で解いた結果のまま登録しています。ほかの人も、それぞれの端末で計算根拠を確かめられます。",
} as const

/** The mark on a formula the shared catalog took unchecked. */
export const UNCHECKED = "検算なし"
