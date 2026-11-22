import type { JSX } from "solid-js"

import { createTypedOver } from "./typed-over"

/**
 * A short number typed where it stands beside a heading, a cabinet's
 * number beside a machine's: unknown, it shows `----`. Filled, it is typed
 * over as every other number field is: taking the focus marks its text,
 * and the first key typed replaces it, or the first deletion empties it.
 */
export function InlineNumberInput(props: {
  readonly label: string
  readonly value: string
  readonly onInput: (value: string) => void
  readonly onFocus?: () => void
  readonly invalid?: boolean
  readonly title?: string | undefined
  readonly masked?: boolean
}): JSX.Element {
  const over = createTypedOver(() => true)
  return (
    <input
      aria-label={props.label}
      aria-invalid={props.invalid === true}
      title={props.title}
      value={props.value}
      onInput={(event) => props.onInput(event.currentTarget.value)}
      onFocus={(event) => {
        over.onFocus(event)
        props.onFocus?.()
      }}
      onBlur={over.onBlur}
      onPointerDown={over.onPointerDown}
      onKeyDown={over.onKeyDown}
      onCompositionStart={over.onCompositionStart}
      onBeforeInput={over.onBeforeInput}
      inputMode="numeric"
      placeholder="----"
      class="h-6 w-14 rounded-[3px] px-1.5 text-right text-base tabular-nums outline-none placeholder:text-text-muted focus-visible:outline-2 focus-visible:outline-focus-ring"
      classList={{ "bg-accent/30 caret-transparent": over.waiting(), "bg-surface-input": !over.waiting(), "ring-1 ring-negative": props.invalid === true, "[-webkit-text-security:disc]": props.masked === true }}
    />
  )
}
