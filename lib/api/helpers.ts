import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { checkCapability, type Capability } from "@/lib/auth/capabilities"
import { z } from "zod"

export async function getSessionUserId(): Promise<string | null> {
  const session = await getSession()
  return session?.user?.id ?? null
}

export async function requireUserId(): Promise<string | NextResponse> {
  const userId = await getSessionUserId()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  return userId
}

export async function requireCapabilityResponse(
  userId: string,
  capability: Capability,
): Promise<true | NextResponse> {
  if (!(await checkCapability(userId, capability))) {
    return jsonError("Forbidden", 403)
  }
  return true
}

export function jsonOk<T>(data: T, status = 200) {
  return NextResponse.json(data, { status })
}

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status })
}

export function passwordChangeRequiredResponse() {
  return jsonError("Password change required.", 403)
}

export async function parseJson<T extends z.ZodTypeAny>(
  request: Request,
  schema: T,
): Promise<z.infer<T> | NextResponse> {
  try {
    const body = await request.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return jsonError(parsed.error.message, 422)
    }
    return parsed.data
  } catch {
    return jsonError("Invalid JSON body", 400)
  }
}

export { parsePagination } from "@/lib/api/pagination"

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

export function newId(): string {
  return crypto.randomUUID()
}
