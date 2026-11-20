import { describe, expect, test } from "bun:test"

import { lineageOf, type Lineal } from "../../src/core/formula/lineage"

const formula = (id: string, createdAt: string, derivedFrom?: string): Lineal => ({ id, createdAt, derivedFrom })

const shape = (formulas: readonly Lineal[]): readonly string[] => lineageOf(formulas).map((row) => `${"-".repeat(row.depth)}${row.formula.id}`)

describe("lineageOf", () => {
  test("sets each fork under the one it was remade from, oldest first at every depth", () => {
    const formulas = [
      formula("c", "2026-11-10T00:00:00Z", "a"),
      formula("b", "2026-11-05T00:00:00Z"),
      formula("a", "2026-11-01T00:00:00Z"),
      formula("d", "2026-11-19T00:00:00Z", "c"),
      formula("e", "2026-11-08T00:00:00Z", "a"),
    ]
    expect(shape(formulas)).toEqual(["a", "-e", "-c", "--d", "b"])
  })

  test("says what a tree draws: the lines going on above, the last fork, and which have forks", () => {
    const formulas = [
      formula("a", "2026-11-01T00:00:00Z"),
      formula("b", "2026-11-02T00:00:00Z", "a"),
      formula("c", "2026-11-03T00:00:00Z", "b"),
      formula("d", "2026-11-04T00:00:00Z", "a"),
      formula("e", "2026-11-05T00:00:00Z", "d"),
    ]
    expect(lineageOf(formulas).map((row) => ({ id: row.formula.id, through: row.through, last: row.last, forked: row.forked }))).toEqual([
      { id: "a", through: [], last: true, forked: true },
      { id: "b", through: [], last: false, forked: true },
      { id: "c", through: [true], last: true, forked: false },
      { id: "d", through: [], last: true, forked: true },
      { id: "e", through: [false], last: true, forked: false },
    ])
  })

  test("starts a line of its own for a formula remade from one the machine does not list", () => {
    expect(shape([formula("a", "2026-11-01T00:00:00Z"), formula("b", "2026-11-02T00:00:00Z", "elsewhere")])).toEqual(["a", "b"])
  })

  test("leaves out a loop no formula outside it leads into, rather than going round it", () => {
    expect(shape([formula("a", "2026-11-01T00:00:00Z", "b"), formula("b", "2026-11-02T00:00:00Z", "a"), formula("c", "2026-11-03T00:00:00Z")])).toEqual(["c"])
  })
})
