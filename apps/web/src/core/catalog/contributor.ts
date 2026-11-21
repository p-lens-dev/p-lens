import { CONTRIBUTOR_NAME, readableContributorName } from "@p-lens/contracts"

import { Err, Ok, type Result } from "../result/result"

/**
 * What a handle typed to sign a formula with is wrong with: longer than the
 * catalog takes, punctuation and symbols alone with nothing to read, or a
 * link, which would make a thanks an advertisement. Indecent words are the
 * catalog's to refuse.
 */
export type ContributorNameProblem = { readonly type: "too-long"; readonly longest: number } | { readonly type: "unreadable" } | { readonly type: "link" }

/** The handle a formula is signed with, as typed; none typed is none. */
export const readContributorName = (typed: string): Result<string | undefined, ContributorNameProblem> => {
  const name = typed.trim()
  if (name === "") return Ok(undefined)
  if ([...name].length > CONTRIBUTOR_NAME.length) return Err({ type: "too-long", longest: CONTRIBUTOR_NAME.length })
  if (!readableContributorName(name)) return Err({ type: "unreadable" })
  return /https?:|www\./i.test(name) ? Err({ type: "link" }) : Ok(name)
}
