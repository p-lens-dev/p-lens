/**
 * The names a machine gives the settings it has beside 1 to 6, by the
 * number the engine orders them by: 設定L below the first, 設定H and 設定V
 * above the sixth. 設定0 is its own number.
 */
const NAMED: Readonly<Record<number, string>> = { [-1]: "L", 7: "H", 8: "V" }

/** A setting level as a sheet marks it: `1`, `L`, `H`; `--` where none is known. */
export const settingLevelMark = (level: number | undefined): string => (level === undefined ? "--" : (NAMED[level] ?? String(level)))

/** A setting level as it is said: 設定1, 設定L, 設定H. */
export const settingLevelText = (level: number | undefined): string => `設定${settingLevelMark(level)}`
