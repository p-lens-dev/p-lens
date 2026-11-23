import { createSignal, For, Show, type JSX } from "solid-js"

import { DOCUMENT_KINDS } from "../../../core/document/document"
import { useApp } from "../../context"
import { useMoves } from "../../navigation/moves"
import { CloseIcon, QuestionIcon } from "../../primitives/icons"
import { documentTitle, OPERATOR_PAGE } from "../../wording/documents"
import { WELCOME_AGAIN } from "../../wording/onboarding"
import { UNDER_THE_HOOD_TITLE } from "../../wording/under-the-hood"
import { useWelcome } from "../onboarding/welcome"

/**
 * A question mark in the top bar's corner that says what P-Lens is in a
 * line — a private book of one's play, filled from what is recorded at the
 * cabinet — leaving how far the book goes and how it is kept to
 * このアプリの仕様; and at its foot,
 * where its licences are and, where the deployment has one, where the
 * product's own site is. It drops down from the mark and stays
 * until closed, with nothing darkened behind it. The welcome is opened
 * again from its foot, before the documents the
 * deployment puts before people, its terms and its privacy policy, which
 * are linked from there where there are any, then the licences and
 * このアプリの仕様 in the settings; and under them who runs the deployment and
 * the version of the app this copy was built from. It scrolls within
 * itself, its bar hidden, where all that is taller than the screen.
 */
export function AboutButton(): JSX.Element {
  const moves = useMoves()
  const app = useApp()
  const welcome = useWelcome()
  const [open, setOpen] = createSignal(false)
  return (
    <div class="relative">
      <button
        type="button"
        onClick={() => setOpen((was) => !was)}
        aria-label={`${app.services.name} について`}
        title={`${app.services.name} について`}
        aria-expanded={open()}
        class="flex size-7 items-center justify-center rounded text-text-muted hover:bg-surface-3 hover:text-text-primary [&_svg]:size-5"
        classList={{ "bg-surface-3 text-text-primary": open() }}
      >
        <QuestionIcon />
      </button>
      <Show when={open()}>
        <div class="absolute right-0 top-full z-30 mt-1 flex max-h-[calc(100dvh-4rem)] w-[min(22rem,calc(100vw-1rem))] flex-col gap-3 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden rounded-md border border-border bg-surface-1 p-4 shadow-lg">
          <div class="flex items-center justify-between gap-2">
            <p class="text-sm font-semibold text-text-primary">このアプリについて</p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="閉じる"
              title="閉じる"
              class="-mr-1 flex size-6 items-center justify-center rounded text-text-muted hover:bg-surface-3 hover:text-text-primary [&_svg]:size-4"
            >
              <CloseIcon label="閉じる" />
            </button>
          </div>
          <section class="flex flex-col gap-2 text-sm leading-relaxed text-text-secondary">
            <p>パチンコ・パチスロの収支をつける、プライベートな帳簿アプリです。打ちながら記録すれば、仕訳と期待値が自動で残ります。</p>
          </section>
          <div class="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t border-border pt-3 text-sm">
            <button
              type="button"
              class="text-accent hover:underline"
              onClick={() => {
                setOpen(false)
                welcome.show()
              }}
            >
              {WELCOME_AGAIN}
            </button>
            <For each={DOCUMENT_KINDS.filter((kind) => app.services.documents[kind] !== undefined)}>
              {(kind) => (
                <button
                  type="button"
                  class="text-accent hover:underline"
                  onClick={() => {
                    setOpen(false)
                    moves.go({ kind: "document", document: kind })
                  }}
                >
                  {documentTitle(kind)}
                </button>
              )}
            </For>
            <button
              type="button"
              class="text-accent hover:underline"
              onClick={() => {
                setOpen(false)
                moves.go({ kind: "settings-section", section: "licenses" })
              }}
            >
              ライセンス
            </button>
            <button
              type="button"
              class="text-accent hover:underline"
              onClick={() => {
                setOpen(false)
                moves.go({ kind: "settings-section", section: "under-the-hood" })
              }}
            >
              {UNDER_THE_HOOD_TITLE}
            </button>
            <Show when={app.services.landingPage} keyed>
              {(page) => (
                <a href={page} target="_blank" rel="noreferrer" class="text-accent hover:underline">
                  公式サイト
                </a>
              )}
            </Show>
          </div>
          <div class="flex flex-col gap-0.5 text-xs text-text-muted">
            <p>
              <a href={app.services.operatorPage} target="_blank" rel="noreferrer" class="text-accent hover:underline">
                {OPERATOR_PAGE}
              </a>
            </p>
            <p class="tabular-nums">バージョン {app.services.version}</p>
          </div>
        </div>
      </Show>
    </div>
  )
}
