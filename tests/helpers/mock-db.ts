import { mock } from "bun:test"

export const dbInsertValues = mock(async (_row: unknown) => undefined)
export const dbInsert = mock((_table: unknown) => ({ values: dbInsertValues }))
export const dbExecute = mock(async () => {
  throw new Error("use memory rate limit")
})

type TxFn = (tx: unknown) => unknown

let runTransaction: (fn: TxFn) => unknown = (fn) => fn({ insert: dbInsert, execute: dbExecute })

export function setDbTransaction(handler: (fn: TxFn) => unknown) {
  runTransaction = handler
}

export function resetSharedDbInsert() {
  dbInsertValues.mockReset()
  dbInsert.mockReset()
  dbInsert.mockImplementation((_table: unknown) => ({ values: dbInsertValues }))
  dbInsertValues.mockImplementation(async () => undefined)
}

export function resetSharedDbExecute() {
  dbExecute.mockReset()
  dbExecute.mockImplementation(async () => {
    throw new Error("use memory rate limit")
  })
}

export const mockedDb = {
  insert: dbInsert,
  execute: dbExecute,
  transaction: (fn: TxFn) => runTransaction(fn),
}

// Last mock.module("@/lib/db") wins process-wide; keep insert, transaction, and execute on one object.
mock.module("@/lib/db", () => ({
  db: mockedDb,
}))
