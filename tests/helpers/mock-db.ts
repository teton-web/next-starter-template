import { mock } from "bun:test"
import { capabilitiesMockExports } from "./mock-capabilities"

export const dbInsertValues = mock(async (_row: unknown) => undefined)
export const dbInsertOnConflictDoUpdate = mock(async (_opts?: unknown) => undefined)
export const dbInsertOnConflictDoNothing = mock(async (_opts?: unknown) => undefined)

function thenableInsert(pending: Promise<unknown>) {
  return Object.assign(pending, {
    returning: (_fields?: unknown) => pending,
    onConflictDoUpdate: (opts?: unknown) => {
      dbInsertOnConflictDoUpdate(opts)
      return thenableInsert(pending)
    },
    onConflictDoNothing: (opts?: unknown) => {
      dbInsertOnConflictDoNothing(opts)
      return thenableInsert(pending)
    },
  })
}

function insertBuilder(_table: unknown) {
  return {
    values(row: unknown) {
      return thenableInsert(Promise.resolve(dbInsertValues(row)))
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

// Last mock.module("@/lib/auth/capabilities") also wins process-wide. Preload the
// full ESM surface so a later partial stub cannot drop sanitizeCapabilities on Linux.
mock.module("@/lib/auth/capabilities", () => capabilitiesMockExports())
