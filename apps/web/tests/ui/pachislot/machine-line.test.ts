import { describe, expect, test } from "bun:test"

import { machineDiscriminationText, signMeaningText } from "../../../src/ui/wording/pachislot/formula"

describe("a pachislot machine's line in a list", () => {
  test("ends with the grade of its best counter, after how long ago a formula came — in hours within the day, in days within the month", () => {
    const now = "2026-11-20T12:00:00.000Z"
    expect(machineDiscriminationText(1.92, "2026-11-20T11:30:00.000Z", now)).toEqual({ lead: "1時間以内更新・判別力", grade: "S" })
    expect(machineDiscriminationText(1.92, "2026-11-20T07:00:00.000Z", now)).toEqual({ lead: "5時間前更新・判別力", grade: "S" })
    expect(machineDiscriminationText(0.47, "2026-11-19T12:30:00.000Z", now)).toEqual({ lead: "23時間前更新・判別力", grade: "C" })
    expect(machineDiscriminationText(0.47, "2026-11-17T09:00:00.000Z", now)).toEqual({ lead: "3日前更新・判別力", grade: "C" })
    expect(machineDiscriminationText(0.47, "2026-10-21T11:00:00.000Z", now)).toEqual({ lead: "30日前更新・判別力", grade: "C" })
    expect(machineDiscriminationText(0.47, "2026-10-20T11:00:00.000Z", now)).toEqual({ lead: "判別力", grade: "C" })
    expect(machineDiscriminationText(undefined, undefined, now)).toEqual({ lead: "判別力", grade: "--" })
  })
})

describe("what a sign says of the setting", () => {
  test("is the lowest level it is seen above, the one it is seen alone under, the one it rules out, a parity, or its levels", () => {
    const six = [1, 2, 3, 4, 5, 6]
    expect(signMeaningText([4, 5, 6], six)).toBe("設定4以上濃厚")
    expect(signMeaningText([2, 3, 4, 5, 6], six)).toBe("設定2以上濃厚")
    expect(signMeaningText([1, 2, 3, 4, 5], six)).toBe("設定6否定")
    expect(signMeaningText([6], six)).toBe("設定6濃厚")
    expect(signMeaningText([1, 3, 4, 5, 6], six)).toBe("設定2否定")
    expect(signMeaningText([2, 4, 6], six)).toBe("偶数設定濃厚")
    expect(signMeaningText([1, 3, 5], six)).toBe("奇数設定濃厚")
    expect(signMeaningText([1, 5, 6], six)).toBe("設定1・5・6濃厚")
    expect(signMeaningText([4, 5, 6], [1, 2, 4, 5, 6])).toBe("設定4以上濃厚")
  })
})
