import { describe, expect, test } from "bun:test"

import { worthOf as pachinkoWorthOf } from "../../src/core/pachinko/formula"
import { worthOf as pachislotWorthOf } from "../../src/core/pachislot/formula"
import { autoSelect, ranked, scoreOf, selectById, usesWeighTheirMost, type FormulaListing, type Making, type Measure, type Ranked, type Standing } from "../../src/core/formula/standing"

const listing = (id: string, standing: Partial<Standing>, createdAt = "2026-10-01T00:00:00.000Z"): FormulaListing<Ranked> => ({
  formula: { id, createdAt, derivedFrom: undefined },
  standing: { verifications: 0, refutations: 0, adoptions: 0, rejections: 0, favorites: 0, uses: 0, ...standing },
})

/** One tier for all, nothing filled, every use counted whole and worth deciding nothing. */
const sameWorth: Measure<Ranked> = { tier: () => 0, details: () => new Set(), stagesPassed: [], worth: () => 0 }

describe("ranking formulas", () => {
  const ids = (order: readonly FormulaListing<Ranked>[]): readonly string[] => order.map((each) => each.formula.id)

  test("a score is checks, adoptions and uses, each by its weight, summed: a check is worth five adoptions, a hundred uses half of one", () => {
    expect(scoreOf(listing("x", { verifications: 1 }))).toBe(scoreOf(listing("y", { adoptions: 5 })))
    expect(scoreOf(listing("x", { adoptions: 1 }))).toBe(scoreOf(listing("y", { uses: 200 })))
    expect(scoreOf(listing("x", { verifications: 3, refutations: 3, adoptions: 2, rejections: 2, favorites: 900 }))).toBe(0)
  })

  const made = (id: string, kind: Making, standing: Partial<Standing>): FormulaListing<Ranked> => ({ ...listing(id, standing), formula: { id, createdAt: "2026-10-01T00:00:00.000Z", kind, derivedFrom: undefined } })

  test("how a formula was made weighs too: worked out from a basis sixteen points, sampled thirteen, typed in none, and a 設定配分 none", () => {
    expect([scoreOf(made("m", "manual", {})), scoreOf(made("s", "sampled", {})), scoreOf(made("b", "simulated", {})), scoreOf(listing("d", {}))]).toEqual([0, 1_300, 1_600, 0])
    expect(ids(ranked([made("typed", "manual", {}), made("sampled", "sampled", {}), made("worked", "simulated", {})], sameWorth))).toEqual(["worked", "sampled", "typed"])
    expect(ids(ranked([made("sampled", "sampled", {}), made("typed", "manual", { uses: 1_299 })], sameWorth))).toEqual(["sampled", "typed"])
  })

  test("uses weigh at most a hundredth short of sixteen points, however many they are", () => {
    expect([scoreOf(listing("x", { uses: 1_599 })), scoreOf(listing("x", { uses: 1_600 })), scoreOf(listing("x", { uses: 1_000_000 }))]).toEqual([1_599, 1_599, 1_599])
    expect(ids(ranked([made("typed", "manual", { uses: 1_000_000 }), made("worked", "simulated", {})], sameWorth))).toEqual(["worked", "typed"])
    expect(ids(ranked([made("worked", "simulated", {}), made("typed", "manual", { uses: 1_000_000, adoptions: 1 })], sameWorth))).toEqual(["typed", "worked"])
    expect([1_598, 1_599, 1_600].map((uses) => usesWeighTheirMost(listing("x", { uses }).standing))).toEqual([false, true, true])
  })

  test("all a maker can give one typed in never lifts it over one sampled, and one more person's adoption does over one nobody marked", () => {
    const ownTyped = { adoptions: 1, verifications: 1 }
    expect(ids(ranked([made("typed", "manual", ownTyped), made("sampled", "sampled", {})], sameWorth))).toEqual(["sampled", "typed"])
    expect(ids(ranked([made("sampled", "sampled", {}), made("typed", "manual", { adoptions: 2, verifications: 1 })], sameWorth))).toEqual(["typed", "sampled"])
    expect(ids(ranked([made("worked", "simulated", {}), made("sampled", "sampled", { adoptions: 2 })], sameWorth))).toEqual(["sampled", "worked"])
    expect(ids(ranked([made("worked", "simulated", {}), made("typed", "manual", { adoptions: 7 })], sameWorth))).toEqual(["worked", "typed"])
    expect(ids(ranked([made("worked", "simulated", {}), made("typed", "manual", { adoptions: 9 })], sameWorth))).toEqual(["typed", "worked"])
  })

  test("the higher score comes first, so many adoptions outweigh one check and one more adoption outweighs any use short of two hundred", () => {
    expect(ids(ranked([listing("checked", { verifications: 1 }), listing("adopted", { adoptions: 6 })], sameWorth))).toEqual(["adopted", "checked"])
    expect(ids(ranked([listing("adopted", { adoptions: 4 }), listing("checked", { verifications: 1 })], sameWorth))).toEqual(["checked", "adopted"])
    expect(ids(ranked([listing("used", { uses: 199 }), listing("adopted", { adoptions: 1 })], sameWorth))).toEqual(["adopted", "used"])
  })

  test("a refutation counts against a verification, a rejection against an adoption, and a favourite for nothing", () => {
    const order = ranked(
      [
        listing("refuted", { verifications: 3, refutations: 3, adoptions: 9 }),
        listing("held", { verifications: 2 }),
        listing("rejected", { adoptions: 10, rejections: 9, favorites: 900 }),
        listing("adopted", { adoptions: 2 }),
      ],
      sameWorth,
    )
    expect(ids(order)).toEqual(["held", "refuted", "adopted", "rejected"])
  })

  test("between two of the same score, the newer comes first; between two made at once, the harsher", () => {
    const worth: Readonly<Record<string, number>> = { kind: 15.2, harsh: 14.6, harshTwin: 14.6 }
    const order = ranked(
      [
        listing("older", { verifications: 1 }, "2026-09-01T00:00:00.000Z"),
        listing("kind", { verifications: 1 }, "2026-10-03T00:00:00.000Z"),
        listing("harshTwin", { verifications: 1 }, "2026-10-03T00:00:00.000Z"),
        listing("harsh", { verifications: 1 }, "2026-10-03T00:00:00.000Z"),
        listing("used", { verifications: 1, uses: 1 }, "2026-08-01T00:00:00.000Z"),
      ],
      { ...sameWorth, worth: (formula) => worth[formula.id] ?? 99 },
    )
    expect(ids(order)).toEqual(["used", "harsh", "harshTwin", "kind", "older"])
  })

  test("a higher tier ranks first, whatever the score", () => {
    const tiers: Readonly<Record<string, number>> = { telling: 2, checked: 1 }
    const order = ranked([listing("checked", { verifications: 3 }), listing("telling", {})], { ...sameWorth, tier: (each) => tiers[each.formula.id] ?? 0 })
    expect(ids(order)).toEqual(["telling", "checked"])
  })

  test("uses made before a stage of publication count half for each such stage passed", () => {
    const early = listing("early", { uses: 800 }, "2026-06-01T09:00:00.000Z")
    const late = listing("late", { uses: 300 }, "2026-07-20T09:00:00.000Z")
    const order = (stagesPassed: readonly string[]) => ids(ranked([early, late], { ...sameWorth, stagesPassed }))
    expect(order([])).toEqual(["early", "late"])
    expect(order(["2026-06-11"])).toEqual(["early", "late"])
    expect(order(["2026-06-11", "2026-06-22"])).toEqual(["late", "early"])
  })

  test("a fork gains an adoption's two points, its parent listed or hidden, and one for each kind of detail it fills over a parent listed, five at most; a copy derives from nothing and gains none", () => {
    const parent = listing("parent", { adoptions: 1, uses: 150 }, "2026-09-01T00:00:00.000Z")
    const fork = { ...listing("fork", {}, "2026-09-10T00:00:00.000Z"), formula: { id: "fork", createdAt: "2026-09-10T00:00:00.000Z", derivedFrom: "parent" } }
    const copy = listing("copy", {}, "2026-09-10T00:00:00.000Z")
    const orphan = { ...listing("orphan", {}, "2026-09-10T00:00:00.000Z"), formula: { id: "orphan", createdAt: "2026-09-10T00:00:00.000Z", derivedFrom: "hidden" } }
    const used = listing("used", { uses: 150 }, "2026-09-01T00:00:00.000Z")
    expect(ids(ranked([used, copy], sameWorth))).toEqual(["used", "copy"])
    expect(ids(ranked([used, orphan], sameWorth))).toEqual(["orphan", "used"])
    expect(ids(ranked([parent, fork], sameWorth))).toEqual(["parent", "fork"])
    const details: Readonly<Record<string, ReadonlySet<string>>> = { parent: new Set(["regularGame"]), fork: new Set(["regularGame", "allotment", "supportDrift"]) }
    expect(ids(ranked([parent, fork], { ...sameWorth, details: (each) => details[each.id] ?? new Set() }))).toEqual(["fork", "parent"])
    const filledMany = { ...listing("many", {}, "2026-09-10T00:00:00.000Z"), formula: { id: "many", createdAt: "2026-09-10T00:00:00.000Z", derivedFrom: "parent" } }
    const plenty = new Set(["a", "b", "c", "d", "e", "f", "g", "h"])
    const checked = { ...parent, standing: { ...parent.standing, verifications: 1 } }
    expect(ids(ranked([checked, filledMany], { ...sameWorth, details: (each) => (each.id === "many" ? plenty : new Set()) }))).toEqual(["parent", "many"])
  })

  test("a fork remade in turn gives its weight up to the one remade from it, so the newest of a line rises, uses aside", () => {
    const base = listing("base", {}, "2026-09-01T00:00:00.000Z")
    const first = { ...listing("first", { uses: 1 }, "2026-09-10T00:00:00.000Z"), formula: { id: "first", createdAt: "2026-09-10T00:00:00.000Z", derivedFrom: "base" } }
    const second = { ...listing("second", {}, "2026-09-20T00:00:00.000Z"), formula: { id: "second", createdAt: "2026-09-20T00:00:00.000Z", derivedFrom: "first" } }
    expect(ids(ranked([base, first, second], sameWorth))).toEqual(["second", "first", "base"])
  })
})

describe("choosing a machine's formula", () => {
  const verified = listing("verified", { verifications: 2, adoptions: 3 })
  const mine = listing("mine", { adoptions: 40 })
  const none: ReadonlySet<string> = new Set()

  test("the book's favourite is chosen, and says it was", () => {
    expect(autoSelect([verified, mine], sameWorth, new Set(["mine"]))).toEqual({ by: "favorite", listing: mine })
  })

  test("without a favourite, the best ranked is chosen", () => {
    expect(autoSelect([listing("x", {}), verified], sameWorth, none)).toEqual({ by: "ranking", listing: verified })
    expect(autoSelect([], sameWorth, none)).toBeUndefined()
  })

  test("a choice by hand is taken as given", () => {
    expect(selectById([verified, mine], "mine")).toEqual({ by: "person", listing: mine })
    expect(selectById([verified], "gone")).toBeUndefined()
  })
})

describe("what a formula makes a play worth", () => {
  test("is a pachinko formula's balls a spin: a round's balls over the spins a round takes", () => {
    const figures = { payoutPerRound: 140, roundChanceOneIn: 14, totalChanceOneIn: undefined, spinsPerHour: undefined }
    expect(pachinkoWorthOf({ figures })).toBe(10)
    expect(pachinkoWorthOf({ figures: { ...figures, roundChanceOneIn: 16 } })).toBeLessThan(10)
    expect(pachinkoWorthOf({ figures: { ...figures, payoutPerRound: 130 } })).toBeLessThan(10)
  })

  test("is a pachislot formula's 機械割 taken evenly over its setting levels", () => {
    const level = (settingLevel: number, payoutRate: number) => ({ settingLevel, payoutRate, bonuses: [], combinedOneIn: 100 })
    expect(pachislotWorthOf({ figures: [level(1, 0.97), level(6, 1.09)] })).toBeCloseTo(1.03, 12)
    expect(pachislotWorthOf({ figures: [] })).toBe(0)
  })
})
