import { describeReadingProblem } from "../ui/import-wording"
import type { Field, GeneralProblem } from "./csv-import"

/** 汎用形式, a person's own file, as its tabs and the book's activity call it. */
export const GENERAL_NAME = "汎用形式"

/** This app's fields a column of a person's own file may be taken in as, as the person is offered them. */
export const FIELD_NAMES: Readonly<Record<Field, string>> = {
  date: "日付",
  parlor: "店舗",
  gameKind: "種別",
  machine: "機種",
  cabinetNumber: "台番号",
  outlay: "投資",
  takings: "回収",
  result: "収支",
  theoreticalValue: "期待値",
  spins: "回転数",
  regularSpins: "通常回転数",
  games: "ゲーム数",
  jackpots: "大当り回数",
  ats: "AT回数",
  bonuses: "ボーナス回数",
  hours: "稼働時間",
  labels: "タグ",
  memo: "メモ",
  parlorId: "店舗ID",
}

/** The press that goes on from tying a file's columns to this app's fields. */
export const IMPORT_NEXT = "次へ"

/** A column left out of a taking in, as its choice says. */
export const NOT_TAKEN = "取り込まない"

/** Why a person's own file was not taken in, as they are told. */
export const describeGeneralProblem = (problem: GeneralProblem): string =>
  problem.type === "unmapped" ? `取り込む項目に${problem.missing.map((missing) => (missing === "date" ? "日付" : "「投資と回収」か「収支」")).join("と")}を選んでください。` : describeReadingProblem(problem)
