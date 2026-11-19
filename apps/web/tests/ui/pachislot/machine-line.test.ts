import { describe, expect, test } from "bun:test"

import { machineDiscriminationText } from "../../../src/ui/wording/pachislot/formula"

describe("a pachislot machine's line in a list", () => {
  test("ends with the grade of its best counter, after how long ago a formula came — in hours within the day, in days within the month", () => {
    const now = "2026-11-20T12:00:00.000Z"
    expect(machineDiscriminationText(1.92, "2026-11-20T11:30:00.000Z", now)).toBe("1時間以内更新・判別力S")
    expect(machineDiscriminationText(1.92, "2026-11-20T07:00:00.000Z", now)).toBe("5時間前更新・判別力S")
    expect(machineDiscriminationText(0.47, "2026-11-19T12:30:00.000Z", now)).toBe("23時間前更新・判別力B")
    expect(machineDiscriminationText(0.47, "2026-11-17T09:00:00.000Z", now)).toBe("3日前更新・判別力B")
    expect(machineDiscriminationText(0.47, "2026-10-21T11:00:00.000Z", now)).toBe("30日前更新・判別力B")
    expect(machineDiscriminationText(0.47, "2026-10-20T11:00:00.000Z", now)).toBe("判別力B")
    expect(machineDiscriminationText(undefined, undefined, now)).toBe("判別力--")
  })
})
