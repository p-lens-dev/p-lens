import { describe, expect, test } from "bun:test"

import type { IsoDate } from "../../../src/core/calendar/calendar"
import { decimal } from "../../../src/core/decimal/decimal"
import { csvOf } from "../../../src/other-apps/core/csv"
import { tallyTableOf } from "../../../src/other-apps/general/csv-export"
import { notesOf } from "../../../src/other-apps/application/export"
import type { PlayId } from "../../../src/core/play/play"
import type { TallyNotes } from "../../../src/core/report/tally-notes"
import type { TallyLine } from "../../../src/core/report/tally-line"
import type { BookFiles } from "../../../src/core/journal/layout"
import { playLogPath } from "../../../src/core/play-log/checkpoint"
import type { PricePoint } from "../../../src/core/valuation/valuation"

const yen = (amount: number) => decimal(BigInt(amount), 0)

const NO_NOTES: TallyNotes = {
  aside: { clock: undefined, spinPerformance: undefined, realBorder: undefined, sender: undefined, netCounts: undefined },
  playSeconds: undefined,
  netJackpots: undefined,
  netSpins: undefined,
  netRegularSpins: undefined,
  netGames: undefined,
  netAts: undefined,
  netBonuses: undefined,
  userMemo: undefined,
  carriedIn: undefined,
  inferredFormula: undefined,
  tokenRental: undefined,
  tokenExchange: undefined,
  inferredSpinPerformance: undefined,
}

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
]

const PRICES: readonly PricePoint[] = [
  { date: "2026-09-01" as IsoDate, commodity: "枚(20円・723豚の帽子亭店)", rate: decimal(1786n, 2), places: 2 },
  { date: "2026-10-01" as IsoDate, commodity: "枚(20円・723豚の帽子亭店)", rate: decimal(1961n, 2), places: 2 },
  { date: "2026-10-01" as IsoDate, commodity: "玉(4円・ジーステーション第3新東京市店)", rate: decimal(357n, 2), places: 2 },
]

/** A play's log whose head states its corner's terms. */
const logStating = (terms: object): string => `${JSON.stringify({ header: true, terms })}\n`

const NO_FILES: BookFiles = {}

const NO_NOTES_BY_TALLY: ReadonlyMap<PlayId, string> = new Map()

describe("tallies as a table", () => {
  test("a tally is a row under the column names, its amounts plain numbers, its rate as its tokens name it and the book values them on its day", () => {
    expect(
      tallyTableOf(
        [
          {
            tally: { id: "one" as PlayId, date: "2026-09-08" as IsoDate, description: "", parlorId: undefined, gameKind: "pachislot", machine: "ピエロット", cabinetNumber: "45", importedFrom: undefined, theoreticalValue: yen(-800), inferredValue: undefined },
            parlorName: "723豚の帽子亭店",
            machineName: "ピエロット",
            maker: undefined,
            labels: [],
            tokenCommodity: "枚(20円・723豚の帽子亭店)",
            notes: NO_NOTES,
            sides: { spent: yen(10000), won: decimal(123455n, 1) },
            actual: decimal(23455n, 1),
          },
        ],
        NO_FILES,
        PRICES,
        NO_NOTES_BY_TALLY,
      ),
    ).toEqual([COLUMNS, ["2026-09-08", "723豚の帽子亭店", "スロット", "20円", "20", "5.6", "ピエロット", "", "45", "10000", "12345.5", "2345.5", "-800", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "one", ""]])
  })

  test("a tally's rental is as its play's log states it, and its exchange as the book values its tokens", () => {
    expect(
      tallyTableOf(
        [
          {
            tally: { id: "two" as PlayId, date: "2026-10-09" as IsoDate, description: "ジーステーション第3新東京市店 | 稼働", parlorId: "p-1" as never, gameKind: "pachinko", machine: "m-1", cabinetNumber: "101", importedFrom: undefined, theoreticalValue: undefined, inferredValue: yen(1200) },
            parlorName: "ジーステーション第3新東京市店",
            machineName: "流星",
            maker: "made-up",
            labels: [],
            tokenCommodity: "玉(4円・ジーステーション第3新東京市店)",
            notes: {
              aside: { clock: { started: { hour: 22, minute: 30 }, finished: { hour: 1, minute: 5 } }, spinPerformance: decimal(185n, 1), realBorder: decimal(165n, 1), sender: { id: "s-1", name: "ハンマ" }, netCounts: undefined },
              playSeconds: yen(9300),
              netJackpots: 3,
              netSpins: undefined,
              netRegularSpins: undefined,
              netGames: undefined,
              netAts: undefined,
              netBonuses: undefined,
              userMemo: undefined,
              carriedIn: yen(250),
              inferredFormula: "f-1",
              tokenRental: yen(4),
              tokenExchange: yen(28),
              inferredSpinPerformance: decimal(172n, 1),
            },
            sides: { spent: yen(5000), won: yen(8000) },
            actual: yen(3000),
          },
        ],
        { [playLogPath("pachinko", "two" as PlayId)]: logStating({ rental: { yen: 1000, tokens: 260 }, exchange: { yen: 1000, tokens: 280 }, replay: { paidOut: 250, deducted: 250 } }) },
        PRICES,
        NO_NOTES_BY_TALLY,
      )[1],
    ).toEqual(["2026-10-09", "ジーステーション第3新東京市店", "パチンコ", "4円", "3.846154", "28", "流星", "made-up", "101", "5000", "8000", "3000", "", "16.5", "18.5", "", "", "", "3", "", "", "22:30", "01:05", "2:35", "250", "1200", "f-1", "4", "28", "17.2", "ジーステーション第3新東京市店 | 稼働", "", "", "ハンマ", "s-1", "p-1", "two", ""])
  })

  test("a tally in yen takes its rate from its play's log alone", () => {
    expect(
      tallyTableOf(
        [
          {
            tally: { id: "three" as PlayId, date: "2026-10-10" as IsoDate, description: "", parlorId: undefined, gameKind: "pachislot", machine: undefined, cabinetNumber: undefined, importedFrom: undefined, theoreticalValue: undefined, inferredValue: undefined },
            parlorName: undefined,
            machineName: undefined,
            maker: undefined,
            labels: [],
            tokenCommodity: undefined,
            notes: NO_NOTES,
            sides: { spent: yen(1000), won: yen(0) },
            actual: yen(-1000),
          },
        ],
        { [playLogPath("pachislot", "three" as PlayId)]: logStating({ rental: { yen: 1000, tokens: 50 }, exchange: { yen: 10000, tokens: 510 }, replay: { paidOut: 50, deducted: 50 } }) },
        PRICES,
        NO_NOTES_BY_TALLY,
      )[1]?.slice(3, 6),
    ).toEqual(["20円", "20", "5.1"])
  })

  test("a tally's counts, labels and notes each have a cell: the note the person wrote, then the notes under its entry", () => {
    const lines: readonly TallyLine[] = [
      {
        tally: { id: "four" as PlayId, date: "2026-10-11" as IsoDate, description: "ネルフ第3新東京市店 | 北斗", parlorId: undefined, gameKind: "pachislot", machine: undefined, cabinetNumber: undefined, importedFrom: "precord", theoreticalValue: undefined, inferredValue: undefined },
        parlorName: "ネルフ第3新東京市店",
        machineName: "北斗",
        maker: undefined,
        labels: ["イベント", "朝一"],
        tokenCommodity: undefined,
        notes: { ...NO_NOTES, netGames: 1200, netAts: 2, netBonuses: 1, userMemo: "据え置き" },
        sides: { spent: yen(20000), won: yen(0) },
        actual: yen(-20000),
      },
    ]
    const files: BookFiles = { "2026.journal": "2026-10-11 ネルフ第3新東京市店 | 北斗  ; play-id:four, user-memo:据え置き\n    ; 角台\n    費用:遊技  20000 JPY\n    資産:現金\n" }
    const row = tallyTableOf(lines, files, PRICES, notesOf(lines, files))[1]
    expect(row?.slice(15, 21)).toEqual(["", "", "1200", "", "2", "1"])
    expect(row?.slice(31, 33)).toEqual(["イベント,朝一", "据え置き 角台"])
  })

  test("what a tally does not say is an empty cell", () => {
    expect(
      tallyTableOf(
        [
          {
            tally: { id: "one" as PlayId, date: "2026-10-08" as IsoDate, description: "", parlorId: undefined, gameKind: undefined, machine: undefined, cabinetNumber: undefined, importedFrom: undefined, theoreticalValue: undefined, inferredValue: undefined },
            parlorName: undefined,
            machineName: undefined,
            maker: undefined,
            labels: [],
            tokenCommodity: undefined,
            notes: NO_NOTES,
            sides: { spent: yen(0), won: yen(3000) },
            actual: yen(3000),
          },
        ],
        NO_FILES,
        PRICES,
        NO_NOTES_BY_TALLY,
      )[1],
    ).toEqual(["2026-10-08", "", "", "", "", "", "", "", "", "0", "3000", "3000", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "one", ""])
  })
})

describe("rows as CSV", () => {
  test("opens with the mark of UTF-8 and ends each line in CRLF", () => {
    expect(csvOf([["店舗", "収支"], ["東京皇国第8支店", "-500"]])).toBe("﻿店舗,収支\r\n東京皇国第8支店,-500\r\n")
  })

  test("a cell holding a comma, a quote or a line break is quoted, its quotes doubled", () => {
    expect(csvOf([['a,b', 'say "x"', "two\nlines", "plain"]])).toBe('﻿"a,b","say ""x""","two\nlines",plain\r\n')
  })
})
