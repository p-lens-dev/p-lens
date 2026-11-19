import { describe, expect, test } from "bun:test"

import type { NormalizedSpecDto, TableDto } from "@p-lens/contracts/pachislot"

import { discriminationGradeOf, discriminationOf, discriminationPointsOf } from "../../../src/core/pachislot/discrimination"
import type { SettingLevelFigures } from "../../../src/core/pachislot/figures"

/** A made-up AT machine of settings 1 and 6 whose first hits come one in 300 games under both. */
const figures: readonly SettingLevelFigures[] = [1, 6].map((settingLevel) => ({ settingLevel, payoutRate: 1, bonuses: [], combinedOneIn: 300 }))

const table = (settingLevel: number, more: Partial<TableDto>): TableDto => ({ settingLevel, events: [], ...more })

const spec = (low: Partial<TableDto>, high: Partial<TableDto>, more: Partial<NormalizedSpecDto> = {}): NormalizedSpecDto => ({
  schemaVersion: 3,
  bet: 3,
  tables: [table(1, low), table(6, high)],
  ...more,
})

/** What one outcome a trial at p against q tells, by hand: p ln(p/q) + (1−p) ln((1−p)/(1−q)). */
const byHand = (p: number, q: number): number => p * Math.log(p / q) + (1 - p) * Math.log((1 - p) / (1 - q))

describe("a pachislot formula's power to tell setting levels apart", () => {
  test("is what a day of 8000 regular games of a small win counted tells the upper half from the lower", () => {
    const role = (chance: number) => ({ events: [{ id: "direct", kind: { type: "role" as const }, chance }] })
    expect(discriminationOf(spec(role(1 / 20_000), role(1 / 5_000)), figures)).toBeCloseTo(8_000 * byHand(1 / 5_000, 1 / 20_000), 12)
  })

  test("weighs a cue over a moment by its chance a trial and a trial for each first hit", () => {
    const cue = (chance: number) => ({ cues: [{ id: "won", watch: "outcome", chance }] })
    const watched = spec(cue(0.2), cue(0.3), { watches: [{ id: "outcome", moment: "cz-in-at", trials: 1, whole: false }], moments: ["cz-in-at"] })
    expect(discriminationOf(watched, figures)).toBeCloseTo((8_000 / 300) * byHand(0.3, 0.2), 12)
  })

  test("is nothing where nothing counted differs, and nothing for signs, whose chances nobody gives", () => {
    const same = { events: [{ id: "bell", kind: { type: "role" as const }, chance: 1 / 7 }] }
    expect(discriminationOf(spec(same, same), figures)).toBe(0)
    expect(discriminationOf(spec({}, { signs: ["six"] }, { signs: ["six"] }), figures)).toBe(0)
  })

  test("grades S from six times likelier a day, A three, B one and a half, C below", () => {
    expect([6, 5.99, 3, 1.5, 1.49].map((times) => discriminationGradeOf(Math.log(times) + 1e-12))).toEqual(["S", "A", "A", "B", "C"])
    expect([0, 0.11, 1.92, 5.74].map(discriminationPointsOf)).toEqual([0, 10, 85, 100])
  })
})
