import { createSignal, Index, Show, type JSX } from "solid-js"

import type { Tappable } from "../../../../core/pachislot/weighing"
import type { Counts } from "../../../../core/play-log/checkpoint"
import { Unfolding } from "../../../primitives/unfolding"
import { feelTap } from "../../../primitives/vibration"
import { signMeaningText } from "../../../wording/pachislot/formula"

/** A sign on the counter. */
type Sign = Extract<Tappable, { readonly kind: "sign" }>

/**
 * The signs a formula knows — 銅トロフィー, 666枚OVER — kept apart from
 * the tiles counted game by game, under a heading that unfolds them: a
 * tile each, green where the counting tiles are the player's colour, for it
 * works otherwise — seen once is all a sign tells, so a press marks it
 * seen, filled, and a press on one seen takes that back — each by its name
 * with what it says of the setting under it. Inert while the play is counted on
 * another device; a sign is counted in an AT too. Rows are an `<Index>`, so
 * a mark changing never remounts one.
 */
export function SignChecklist(props: {
  readonly signs: readonly Sign[]
  readonly settingLevels: readonly number[]
  readonly counts: Counts
  readonly inert: (tappable: Tappable) => boolean
  readonly onCount: (id: string, by: 1 | -1) => void
}): JSX.Element {
  const [open, setOpen] = createSignal(false)
  const seen = (id: string): boolean => (props.counts[id] ?? 0) > 0
  const seenCount = (): number => props.signs.filter((sign) => seen(sign.id)).length
  return (
    <Show when={props.signs.length > 0}>
      <section class="flex flex-col gap-2">
        <button
          type="button"
          aria-expanded={open()}
          onClick={() => setOpen((was) => !was)}
          class="flex items-center gap-2 self-start rounded px-1 py-1 text-xs font-bold uppercase tracking-wide text-text-secondary hover:bg-surface-3"
        >
          <span>{open() ? "▾" : "▸"}</span>
          確定演出
          <span class="font-normal normal-case tabular-nums text-text-muted">
            {seenCount()}/{props.signs.length} 見た
          </span>
        </button>
        <Unfolding open={open()} gap="-0.5rem">
          <div class="grid grid-cols-2 gap-2 @roomy:grid-cols-3">
            <Index each={props.signs}>
              {(sign) => (
                <button
                  type="button"
                  aria-pressed={seen(sign().id)}
                  onClick={() => {
                    feelTap()
                    props.onCount(sign().id, seen(sign().id) ? -1 : 1)
                  }}
                  class="flex min-h-16 select-none flex-col items-center justify-center gap-0.5 rounded-lg border px-2 py-2 text-center shadow-sm transition active:translate-y-px active:shadow-none"
                  classList={{
                    "opacity-40": props.inert(sign()),
                    "border-semipro bg-semipro text-on-semipro hover:bg-semipro-hover": seen(sign().id),
                    "border-semipro/50 bg-semipro/10 text-text-primary hover:bg-semipro/20": !seen(sign().id),
                  }}
                >
                  <span class="text-sm font-semibold leading-tight">{sign().label}</span>
                  <span class="text-[0.6875rem] leading-tight" classList={{ "text-on-semipro": seen(sign().id), "text-text-muted": !seen(sign().id) }}>
                    {signMeaningText(sign().settingLevels, props.settingLevels)}
                  </span>
                </button>
              )}
            </Index>
          </div>
        </Unfolding>
      </section>
    </Show>
  )
}
