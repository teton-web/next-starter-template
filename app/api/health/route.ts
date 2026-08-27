import { sql } from "drizzle-orm"
import { db } from "@/lib/db"
import { jsonOk } from "@/lib/api/helpers"

export async function GET() {
  try {
    await db.execute(sql`select 1`)
    return jsonOk({ ok: true })
  } catch {
    return jsonOk({ ok: false }, 503)
  }
}
