import { describe, expect, test } from "bun:test"

import { readContributorName } from "../../src/core/catalog/contributor"
import { contributorsText } from "../../src/ui/wording/catalog"

describe("a handle typed to sign a formula with", () => {
  test("is trimmed, and none where nothing is typed", () => {
    expect(readContributorName("  流しの旅打ち ")).toEqual({ ok: true, value: "流しの旅打ち" })
    expect(readContributorName("   ")).toEqual({ ok: true, value: undefined })
  })

  test("is refused when longer than the catalog takes, punctuation alone, or a link", () => {
    expect(readContributorName("、。")).toEqual({ ok: false, error: { type: "unreadable" } })
    expect(readContributorName("！？…")).toEqual({ ok: false, error: { type: "unreadable" } })
    expect(readContributorName("７７７").ok).toBe(true)
    expect(readContributorName("ぱち。").ok).toBe(true)
    expect(readContributorName("あ".repeat(12)).ok).toBe(true)
    expect(readContributorName("あ".repeat(13))).toEqual({ ok: false, error: { type: "too-long", longest: 12 } })
    expect(readContributorName("www.x.jp")).toEqual({ ok: false, error: { type: "link" } })
  })

  test("is thanked among everyone's at the foot of a machine's formulas", () => {
    expect(contributorsText(["流しの旅打ち", "あ"])).toBe("情報提供: 流しの旅打ち様, あ様")
  })
})
