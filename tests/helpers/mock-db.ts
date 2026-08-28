import { mock } from "bun:test"

export const dbInsertValues = mock(async (_row: unknown) => undefined)
export const dbInsertOnConflictDoUpdate = mock(async (_opts?: unknown) => undefined)
export const dbInsertOnConflictDoNothing = mock(async (_opts?: unknown) => undefined)

function insertBuilder(_table: unknown) {
  return {
    values(row: unknown) {
      const pending = Promise.resolve(dbInsertValues(row))
      return Object.assign(pending, {
        onConflictDoUpdate: (opts?: unknown) => {
          dbInsertOnConflictDoUpdate(opts)
          return pending
        },
        onConflictDoNothing: (opts?: unknown) => {
          dbInsertOnConflictDoNothing(opts)
          return pending
        },
      })
    },
  }
}

export const dbInsert = mock((_table: unknown) => insertBuilder(_table))
export const dbExecute = mock(async () => {
  throw new Error("use memory rate limit")
})

type TxFn = (tx: unknown) => unknown

function defaultTransaction(fn: TxFn) {
  return fn({ insert: dbInsert, execute: dbExecute })
}

let runTransaction: (fn: TxFn) => unknown = defaultTransaction

export function setDbTransaction(handler: (fn: TxFn) => unknown) {
  runTransaction = handler
}

export function resetSharedDbTransaction() {
  runTransaction = defaultTransaction
}

export function resetSharedDbInsert() {
  dbInsertValues.mockReset()
  dbInsertOnConflictDoUpdate.mockReset()
  dbInsertOnConflictDoNothing.mockReset()
  dbInsert.mockReset()
  dbInsert.mockImplementation((_table: unknown) => insertBuilder(_table))
  dbInsertValues.mockImplementation(async () => undefined)
  dbInsertOnConflictDoUpdate.mockImplementation(async () => undefined)
  dbInsertOnConflictDoNothing.mockImplementation(async () => undefined)
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

mock.module("server-only", () => ({}))

// Last mock.module("@/lib/db") wins process-wide; keep insert, transaction, and execute on one object.
mock.module("@/lib/db", () => ({
  db: mockedDb,
}))
