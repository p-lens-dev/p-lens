import { Index, onCleanup, onMount, type JSX } from "solid-js"

import type { Tappable } from "../../../../core/pachislot/weighing"
import type { Counts } from "../../../../core/play-log/checkpoint"
import { createLongPress } from "../../../primitives/long-press"
import { feelHold, feelTap } from "../../../primitives/vibration"
import { formatCount } from "../../../wording/numbers"
import { observedOneInText, observedShareText } from "../../../wording/pachislot/formula"

/** How often a tile's count came up in what it is out of: a share of the moments a cue is watched over, and otherwise one in so many. */
const howOftenText = (tappable: Tappable, outOf: number, count: number): string =>
  tappable.kind === "cue-of-moment" ? observedShareText(outOf, count) : observedOneInText(outOf, count)

function CountTile(props: {
  readonly countable: Tappable
  readonly count: number
  readonly outOf: number
  readonly shortcut: number | undefined
  readonly inert: boolean
  readonly onCount: (id: string, by: 1 | -1) => void
}): JSX.Element {
  const press = createLongPress(() => {
    feelHold()
    props.onCount(props.countable.id, -1)
  })
  return (
    <button
      type="button"
      class="flex min-h-24 select-none flex-col items-center justify-center gap-1 rounded-lg border border-amateur/50 bg-amateur/10 px-2 py-3 shadow-sm transition hover:bg-amateur/20 active:translate-y-px active:bg-amateur/30 active:shadow-none"
      classList={{ "opacity-40": props.inert }}
      style={{ "-webkit-touch-callout": "none" }}
      onPointerDown={press.onPointerDown}
      onPointerMove={press.onPointerMove}
      onPointerUp={press.onPointerUp}
      onPointerLeave={press.onPointerLeave}
      onPointerCancel={press.onPointerCancel}
      onContextMenu={press.onContextMenu}
      onClick={() => {
        if (press.wasLong()) return
        feelTap()
        props.onCount(props.countable.id, 1)
      }}
    >
      <span class="text-3xl font-bold tabular-nums text-text-primary">{formatCount(props.count)}</span>
      <span class="text-xs tabular-nums text-text-muted">{howOftenText(props.countable, props.outOf, props.count)}</span>
      <span class="text-center text-xs font-semibold leading-tight text-text-secondary">
        {props.countable.label}
        {props.shortcut === undefined ? "" : <kbd class="ml-0.5 text-[0.625rem] font-normal text-text-muted">{props.shortcut}</kbd>}
      </span>
    </button>
  )
}

/**
 * Tiles to count small wins, bonuses, moments, signs and the cues watched
 * for over a bonus or a moment with, four to a row, drawn as the app's own buttons are — in the colour
 * every player's buttons wear, sinking as they are pressed — so that on a
 * phone, with nothing to hover over, they read as pressed rather than read, each showing its count and how often it has come up
 * in what it is counted out of: the games counted, or a cue's trials. A tap adds one, and a long
 * press takes one back; on a keyboard, the digits press the first nine
 * tiles. Inert while the play is counted on another device, and — those
 * counting what a regular game comes up with — while play is in an AT,
 * they are shown faint; what a press then does is the counting's to say.
 * A moment, a sign or a cue is counted beside the games, in an AT too. Rows are an
 * `<Index>`, so a count changing never remounts a tile.
 */
export function RoleCounter(props: {
  readonly countables: readonly Tappable[]
  readonly counts: Counts
  readonly outOf: (id: string) => number
  readonly inert: (tappable: Tappable) => boolean
  readonly onCount: (id: string, by: 1 | -1) => void
}): JSX.Element {
  const pressed = (event: KeyboardEvent): void => {
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return
    const countable = /^[1-9]$/.test(event.key) ? props.countables[Number(event.key) - 1] : undefined
    if (countable === undefined || props.inert(countable)) return
    event.preventDefault()
    props.onCount(countable.id, 1)
  }
  onMount(() => window.addEventListener("keydown", pressed))
  onCleanup(() => window.removeEventListener("keydown", pressed))
  return (
    <div class="grid grid-cols-4 gap-2">
      <Index each={props.countables}>
        {(countable, index) => (
          <CountTile
            countable={countable()}
            count={props.counts[countable().id] ?? 0}
            outOf={props.outOf(countable().id)}
            shortcut={index < 9 ? index + 1 : undefined}
            inert={props.inert(countable())}
            onCount={props.onCount}
          />
        )}
      </Index>
    </div>
  )
}
