import { Pool as NeonPool } from "@neondatabase/serverless"
import { drizzle as drizzleNeon } from "drizzle-orm/neon-serverless"
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres"
import { Pool as PgPool } from "pg"
import { isLocalTcpPostgresUrl } from "./connection-pure"
import * as schema from "./schema"

const connectionString = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL!

function createDb() {
  if (isLocalTcpPostgresUrl(connectionString)) {
    return drizzlePg(new PgPool({ connectionString }), { schema })
  }
  return drizzleNeon(new NeonPool({ connectionString }), { schema })
}

export const db = createDb()
