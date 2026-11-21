import { describe, expect, test } from "bun:test"

import type { RegisterMachineDto } from "@p-lens/contracts"

import { api, device } from "./support/harness"
import { manual } from "./support/pachinko/formulas"

const ALICE = device(1_759_000_000_001)
const BOB = device(1_759_000_000_002)

const signedMachine = async (contributorName: string | undefined) => {
  const client = await api()
  const formula = { ...manual(), ...(contributorName === undefined ? {} : { contributorName }) }
  const machine = await client.call("POST", "/machines", { as: ALICE, body: { gameKind: "pachinko", modelName: "型式A1", name: "流星無双", releasedOn: "2026-08-04", formula } satisfies RegisterMachineDto })
  return { client, machineId: machine.body.machineId as string, formulaId: machine.body.formulaId as string }
}

const signedFormula = async (client: Awaited<ReturnType<typeof api>>, machineId: string, as: string, contributorName: string, payoutPerRound: number) =>
  client.call("POST", `/machines/${machineId}/formulas`, { as, body: { ...manual(13.9, payoutPerRound), contributorName } })

describe("a formula's handle", () => {
  test("is shown among its machine's contributors, never on the formula it came with", async () => {
    const { client, machineId } = await signedMachine("  流しの旅打ち  ")
    const detail = (await client.call("GET", `/machines/${machineId}`)).body
    expect(detail.contributors).toEqual(["流しの旅打ち"])
    expect(JSON.stringify(detail.formulas)).not.toContain("流しの旅打ち")
  })

  test("is listed once per handle, by who signed first, and only for formulas shown", async () => {
    const { client, machineId } = await signedMachine("あ")
    await signedFormula(client, machineId, BOB, "い", 141)
    const hidden = await signedFormula(client, machineId, BOB, "う", 142)
    await signedFormula(client, machineId, BOB, "あ", 143)
    client.sqlite.query("UPDATE formulas SET hidden_at = '2026-11-21T00:00:00Z' WHERE id = ?1").run(hidden.body.id)
    expect((await client.call("GET", `/machines/${machineId}`)).body.contributors).toEqual(["あ", "い"])
    expect((await client.call("GET", "/catalog")).body.machines[0].contributors).toEqual(["あ", "い"])
  })

  test("is left out where nobody signed, and a blank one signs nothing", async () => {
    const { client, machineId } = await signedMachine("   ")
    expect((await client.call("GET", `/machines/${machineId}`)).body.contributors).toBeUndefined()
  })

  test("is refused when too long, indecent, on more than one line, punctuation alone, or a link", async () => {
    const { client, machineId } = await signedMachine(undefined)
    const refusal = async (name: string) => (await signedFormula(client, machineId, BOB, name, 150)).body.error
    expect(await refusal("あ".repeat(13))).toEqual({ type: "invalid-body", field: "contributorName", reason: "too-long" })
    expect(await refusal("ウンコ")).toEqual({ type: "invalid-body", field: "contributorName", reason: "forbidden" })
    expect(await refusal("あ\nい")).toEqual({ type: "invalid-body", field: "contributorName", reason: "unknown-value" })
    expect(await refusal("、。")).toEqual({ type: "invalid-body", field: "contributorName", reason: "unknown-value" })
    expect(await refusal("・・・")).toEqual({ type: "invalid-body", field: "contributorName", reason: "unknown-value" })
    expect(await refusal("https://x.jp")).toEqual({ type: "invalid-body", field: "contributorName", reason: "unknown-value" })
  })

  test("can be cleared without touching the formula, which stays as it was", async () => {
    const { client, machineId, formulaId } = await signedMachine("消される人")
    client.sqlite.query("UPDATE formulas SET contributor_name = NULL WHERE id = ?1").run(formulaId)
    const detail = (await client.call("GET", `/machines/${machineId}`)).body
    expect([detail.contributors, detail.formulas.length]).toEqual([undefined, 1])
  })
})
