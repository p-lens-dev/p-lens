import type { JSX } from "solid-js"

import { seal } from "../../../../mummer"
import { InfoNote } from "../../../primitives/popover"
import { formatCount, theoreticalFigureText } from "../../../wording/numbers"

/**
 * The small i by a live play's theoretical value a spin, given only where
 * its formula says how many spins an hour plays: that value over an hour
 * (時給), and the pace it was worked out at. Dashes until the play has a
 * value.
 */
export function HourlyValueNote(props: { readonly yenPerHour: number | undefined; readonly spinsPerHour: number }): JSX.Element {
  return (
    <InfoNote label="期待値（時給）について">
      <dl class="grid grid-cols-[auto_auto] gap-x-3 gap-y-0.5 tabular-nums">
        <dt>期待値（時給）</dt>
        <dd class="text-right">{theoreticalFigureText(seal.play(props.yenPerHour))}</dd>
      </dl>
      <p class="mt-1">1時間{formatCount(props.spinsPerHour)}回転として</p>
    </InfoNote>
  )
}
