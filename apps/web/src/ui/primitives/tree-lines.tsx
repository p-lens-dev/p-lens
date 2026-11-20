import { For, Show, type JSX } from "solid-js"

const LINE = "absolute w-0.5 -translate-x-1/2 bg-text-muted"

/**
 * The lines a tree's row draws before what it shows, a column a depth:
 * straight down where a line above goes on past it, then, for a row under
 * another, a turn into the row — going on down where a later one under the
 * same comes after. A column is 24px, and a row's content starts its
 * 16px mark `pl-1` in, so the mark's centre is half a column in and a line
 * falls under the mark of the row it comes from. Nothing for a row at the top.
 */
export function TreeLines(props: { readonly depth: number; readonly through: readonly boolean[]; readonly last: boolean }): JSX.Element {
  return (
    <Show when={props.depth > 0}>
      <For each={props.through}>
        {(goesOn) => (
          <span class="relative w-6 shrink-0" aria-hidden="true">
            <Show when={goesOn}>
              <span class={`${LINE} left-1/2 top-0 bottom-0`} />
            </Show>
          </span>
        )}
      </For>
      <span class="relative w-6 shrink-0" aria-hidden="true">
        <span class={`${LINE} left-1/2 top-0`} classList={{ "bottom-0": !props.last, "bottom-1/2": props.last }} />
        <span class="absolute left-1/2 right-0 top-1/2 h-0.5 -translate-y-1/2 bg-text-muted" />
      </span>
    </Show>
  )
}

/** A line down from a row's mark to the row's foot, for a row others come under: set inside its content, which starts its mark `pl-1` in. */
export function TreeStem(props: { readonly shown: boolean }): JSX.Element {
  return (
    <Show when={props.shown}>
      <span class={`${LINE} left-3 top-[calc(50%+10px)] bottom-0`} aria-hidden="true" />
    </Show>
  )
}
