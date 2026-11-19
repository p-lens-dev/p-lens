import { createSignal, onCleanup, type Accessor } from "solid-js"

import type { Arrangement } from "./panes"

/** Where a window turns narrow: below a width, below a height on a touch screen, or where what stands beside the main content leaves it less than it needs. */
export interface ArrangementBounds {
  /** Below this window width the panes are shown one at a time, whatever stands beside the content. */
  readonly narrowBelow: number
  /** Below this window height too, on a touch screen: a phone held sideways is wide enough for panes side by side, and too short to read them. A desktop window keeps its panes however short it is dragged. */
  readonly shortBelow: number
  /** The least the main content needs: a wide arrangement leaving it less is narrow instead. */
  readonly contentAtLeast: number
}

/** A window: its size in CSS pixels, and whether its main pointer is a finger — a phone's, a tablet's — rather than a mouse or a trackpad. */
export interface Viewport {
  readonly width: number
  readonly height: number
  readonly touch: boolean
}

/**
 * The arrangement a window calls for: narrow below its width, or below its
 * height on a touch screen — a phone held upright, or held sideways, whose
 * width would take panes side by side but whose height leaves room for one;
 * a desktop window short or tall keeps them — or where the panes
 * beside the main content — the rail, the list, a detail — would leave the
 * content less room than it needs, as a tablet held sideways does with a
 * detail open; wide otherwise.
 */
export const arrangementFor = (viewport: Viewport, besideContent: number, bounds: ArrangementBounds): Arrangement =>
  viewport.width < bounds.narrowBelow || (viewport.touch && viewport.height < bounds.shortBelow) || viewport.width - besideContent < bounds.contentAtLeast ? "narrow" : "wide"

/** A window followed: the arrangement it calls for, and where the shell says how wide the panes beside the main content stand. */
export interface ArrangementFollower {
  readonly arrangement: Accessor<Arrangement>
  /** How wide the panes beside the main content stand in a wide arrangement, in pixels, as the shell measures them. */
  readonly besideContent: (width: number) => void
}

/** Whether the window's main pointer is a finger, as the browser says. */
const TOUCH = "(pointer: coarse)"

const viewportNow = (): Viewport => ({ width: document.documentElement.clientWidth, height: document.documentElement.clientHeight, touch: window.matchMedia(TOUCH).matches })

/**
 * Follow the window and say which arrangement it calls for: by how wide and
 * how tall it is, whether a finger is its main pointer, and how much of it
 * the panes beside the main content take, never by what a device is called,
 * so a desktop window dragged thin behaves as a phone does, and turns narrow
 * as soon as the content would be squeezed.
 * Must be called inside a reactive owner, which removes the listener when
 * it goes.
 */
export function createArrangement(bounds: ArrangementBounds): ArrangementFollower {
  const [viewport, setViewport] = createSignal(viewportNow(), { equals: (left, right) => left.width === right.width && left.height === right.height && left.touch === right.touch })
  const [beside, setBeside] = createSignal(0)
  const follow = (): void => {
    setViewport(viewportNow())
  }
  const pointer = window.matchMedia(TOUCH)
  window.addEventListener("resize", follow)
  pointer.addEventListener("change", follow)
  onCleanup(() => {
    window.removeEventListener("resize", follow)
    pointer.removeEventListener("change", follow)
  })
  return { arrangement: () => arrangementFor(viewport(), beside(), bounds), besideContent: setBeside }
}
