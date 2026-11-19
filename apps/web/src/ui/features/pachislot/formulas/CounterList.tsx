import { Index, Show, type JSX } from "solid-js"

import { discriminationOf } from "../../../../core/pachislot/discrimination"
import type { Formula } from "../../../../core/pachislot/formula"
import { snapshotOf } from "../../../../core/pachislot/snapshot"
import { countablesOf, type Tappable, type TappableKind } from "../../../../core/pachislot/weighing"
import { discriminationText, TAPPABLE_KIND_NAMES } from "../../../wording/pachislot/formula"

/** The kinds of tile in the order a formula's screen lists them, a cue over a bonus with a cue over a moment. */
const GROUPS: readonly (readonly TappableKind[])[] = [["game"], ["moment"], ["cue-of-bonus", "cue-of-moment"], ["sign"]]

/** The tiles of one group, by their labels. */
const groupOf = (tiles: readonly Tappable[], kinds: readonly TappableKind[]): readonly string[] => tiles.filter((tile) => kinds.includes(tile.kind)).map((tile) => tile.label)

/**
 * What a formula's counter counts, as its screen lists it: its 判別力, then
 * the tiles a play of it counts at the cabinet, kind by kind — small wins and
 * bonuses, moments, cues, signs — each kind it has none of left out, and
 * dashes where it counts nothing.
 */
export function CounterList(props: { readonly formula: Formula }): JSX.Element {
  const tiles = (): readonly Tappable[] => countablesOf(snapshotOf(props.formula))
  const groups = () => GROUPS.map((kinds) => ({ name: TAPPABLE_KIND_NAMES[kinds[0] ?? "game"], labels: groupOf(tiles(), kinds) })).filter((group) => group.labels.length > 0)
  return (
    <section class="flex flex-col gap-2">
      <h3 class="flex flex-wrap items-baseline gap-x-3 text-sm font-bold text-text-primary">
        カウンター
        <span class="text-xs font-normal tabular-nums text-text-secondary">{discriminationText(discriminationOf(props.formula.basis.normalized, props.formula.figures))}</span>
      </h3>
      <Show when={groups().length > 0} fallback={<p class="text-sm text-text-muted">--</p>}>
        <dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <Index each={groups()}>
            {(group) => (
              <>
                <dt class="whitespace-nowrap text-text-muted">{group().name}</dt>
                <dd class="text-text-primary">{group().labels.join("・")}</dd>
              </>
            )}
          </Index>
        </dl>
      </Show>
    </section>
  )
}
