import { createResource, For, Show, type JSX } from "solid-js"
import { MainContent } from "solid-gathering-shell"

import { loadMachine } from "../../../../application/pachislot/formulas"
import { localDayOf } from "../../../../core/calendar/calendar"
import { lineageOf } from "../../../../core/formula/lineage"
import { useApp } from "../../../context"
import { EmptyState, Loaded } from "../../../primitives/states"
import { TreeLines, TreeStem } from "../../../primitives/tree-lines"
import { useMoves } from "../../../navigation/moves"
import type { Place } from "../../../navigation/place"
import { formulaIdLabel } from "../../../wording/catalog"
import { slashDay } from "../../../wording/dates"
import { formulaChoiceText } from "../../../wording/pachislot/formula"
import { ViewHeader } from "../../shell/ViewHeader"
import { missingUndelivered } from "../../catalog/undelivered"
import { KindMark } from "./KindMark"
import { trailTo } from "./trail"

/**
 * A machine's 更新履歴: its formulas as the lineage of their forks, each
 * under the one it was remade from, oldest first, with the day it was
 * registered, and its id where the pane has room for it whole.
 * A formula is never edited, so this is how a machine's formulas came to
 * be what they are. Pressing one opens it.
 */
export function LineageView(props: { readonly place: Place; readonly machineId: string }): JSX.Element {
  const app = useApp()
  const moves = useMoves()
  const [detail] = createResource(
    () => ({ machineId: props.machineId, revision: app.revision() }),
    (source) => loadMachine(app.services.catalog, source.machineId),
  )
  const trail = () => {
    const found = detail()
    return found?.ok === true ? [...trailTo(moves, "machine", found.value.machine, undefined), { label: "更新履歴" }] : undefined
  }
  return (
    <MainContent header={<ViewHeader place={props.place} title="更新履歴" trail={trail()} />}>
      <div class="max-w-5xl">
        <Loaded outcome={missingUndelivered(detail(), app.delivery.state())}>
          {(found) => {
            const formulas = found.formulas.map((listing) => listing.formula)
            return (
              <div class="flex flex-col gap-3 p-4">
                <p class="text-sm text-text-muted">算出条件は直さずに作り直して増えていきます。作り直したものは、元の算出条件の下に並びます。</p>
                <Show when={formulas.length > 0} fallback={<EmptyState title="算出条件はまだありません" />}>
                  <ul class="flex flex-col">
                    <For each={lineageOf(formulas)}>
                      {(row) => (
                        <li>
                          <button
                            type="button"
                            onClick={() => moves.go({ kind: "pachislot-formula", machineId: found.machine.id, formulaId: row.formula.id })}
                            class="flex w-full items-stretch rounded px-3 text-left hover:bg-surface-3/60"
                          >
                            <TreeLines depth={row.depth} through={row.through} last={row.last} />
                            <span class="relative flex min-w-0 flex-1 items-center gap-2 py-2 pl-1">
                              <TreeStem shown={row.forked} />
                              <KindMark kind={row.formula.kind} />
                              <span class="flex min-w-0 flex-1 items-baseline gap-1">
                                <span class="min-w-0 break-words text-text-primary">{formulaChoiceText(row.formula)}</span>
                                <span class="hidden shrink-0 text-xs text-text-muted @roomy:inline">（{formulaIdLabel(row.formula.id)}）</span>
                              </span>
                              <span class="shrink-0 text-xs tabular-nums text-text-muted">{slashDay(localDayOf(new Date(row.formula.createdAt)))}</span>
                            </span>
                          </button>
                        </li>
                      )}
                    </For>
                  </ul>
                </Show>
              </div>
            )
          }}
        </Loaded>
      </div>
    </MainContent>
  )
}
