import { describe, expect, test } from "bun:test"

import { arrangementFor } from "../src/arrangement"

const BOUNDS = { narrowBelow: 768, shortBelow: 500, contentAtLeast: 480 } as const

const touch = (width: number, height: number) => ({ width, height, touch: true })
const desktop = (width: number, height: number) => ({ width, height, touch: false })

describe("the arrangement a window calls for", () => {
  test("is narrow below its width, whatever stands beside the content", () => {
    expect(arrangementFor(touch(744, 1133), 0, BOUNDS)).toBe("narrow")
    expect(arrangementFor(desktop(900, 700), 364, BOUNDS)).toBe("wide")
  })

  test("is narrow below its height on a touch screen, as a phone held sideways, however wide; a tablet held sideways stays wide, and a desktop window however short", () => {
    expect(arrangementFor(touch(915, 360), 364, BOUNDS)).toBe("narrow")
    expect(arrangementFor(touch(667, 375), 0, BOUNDS)).toBe("narrow")
    expect(arrangementFor(touch(1133, 744), 364, BOUNDS)).toBe("wide")
    expect(arrangementFor(desktop(1440, 800), 364, BOUNDS)).toBe("wide")
    expect(arrangementFor(desktop(1280, 420), 364, BOUNDS)).toBe("wide")
  })

  test("is narrow where the panes beside the content would leave it too little, as a tablet held sideways with a detail open", () => {
    expect(arrangementFor(touch(1133, 744), 364, BOUNDS)).toBe("wide")
    expect(arrangementFor(touch(800, 744), 364, BOUNDS)).toBe("narrow")
    expect(arrangementFor(touch(1133, 744), 364 + 450, BOUNDS)).toBe("narrow")
    expect(arrangementFor(desktop(1440, 900), 364 + 450, BOUNDS)).toBe("wide")
  })
})
