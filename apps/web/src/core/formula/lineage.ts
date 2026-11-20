/** What a formula's place in its machine's lineage is read from: when it was registered, and the one it was remade from. */
export interface Lineal {
  readonly id: string
  readonly createdAt: string
  readonly derivedFrom: string | undefined
}

/**
 * A formula in its machine's lineage, with what a tree of it draws beside
 * it: how many forks down from a formula remade from none of the machine's
 * it stands, whether each line above it goes on past it to a later fork,
 * whether it is the last fork of the one it was remade from, and whether
 * any were remade from it.
 */
export interface LineageRow<F extends Lineal> {
  readonly formula: F
  readonly depth: number
  /** For each depth between the first and this one's, whether the formula there has a later fork still to come below. */
  readonly through: readonly boolean[]
  readonly last: boolean
  readonly forked: boolean
}

const byRegistration = <F extends Lineal>(left: F, right: F): number => left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id)

/**
 * A machine's formulas as the lineage of their forks, each under the one it
 * was remade from, oldest first at every depth. A formula remade from one
 * the machine does not list — another machine's, or one not delivered —
 * starts a line of its own, as one remade from none does.
 */
export const lineageOf = <F extends Lineal>(formulas: readonly F[]): readonly LineageRow<F>[] => {
  const listed = new Set(formulas.map((formula) => formula.id))
  const parentOf = (formula: F): string | undefined => (formula.derivedFrom !== undefined && listed.has(formula.derivedFrom) && formula.derivedFrom !== formula.id ? formula.derivedFrom : undefined)
  const ordered = formulas.toSorted(byRegistration)
  const childrenOf = (id: string | undefined, seen: ReadonlySet<string>): readonly F[] => ordered.filter((formula) => parentOf(formula) === id && !seen.has(formula.id))
  const descend = (formula: F, depth: number, through: readonly boolean[], last: boolean, seen: ReadonlySet<string>): readonly LineageRow<F>[] => {
    const below = new Set([...seen, formula.id])
    const forks = childrenOf(formula.id, below)
    const onward = depth === 0 ? through : [...through, !last]
    return [
      { formula, depth, through, last, forked: forks.length > 0 },
      ...forks.flatMap((fork, index) => descend(fork, depth + 1, onward, index === forks.length - 1, below)),
    ]
  }
  const roots = childrenOf(undefined, new Set())
  return roots.flatMap((root, index) => descend(root, 0, [], index === roots.length - 1, new Set()))
}
