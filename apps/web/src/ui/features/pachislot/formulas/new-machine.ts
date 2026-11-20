import type { Moves } from "../../../navigation/moves"
import type { StartFormState } from "../../live/start-form"

/**
 * Off to register a machine the catalog does not have, by making its first
 * formula: the start form let go of any machine chosen, the new one's name
 * begun as given, and the rest of it left to be typed.
 */
export const registerNewMachine = (start: StartFormState, moves: Moves, name: string): void => {
  start.updatePachislot({ machine: { type: "none" }, formulaId: undefined, prior: undefined, remakeFrom: undefined, newMachineName: name, newMachineModelName: "", newMachineKeywords: "", newMachineReleasedOn: "" })
  moves.go({ kind: "pachislot-formula-new", tab: "manual" })
}
