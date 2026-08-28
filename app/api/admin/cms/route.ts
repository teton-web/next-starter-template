import { desc } from "drizzle-orm"
import { z } from "zod"
import { db } from "@/lib/db"
import { cmsEntries, cmsRevisions, mediaUsages } from "@/lib/db/schema"
import { jsonOk, requireCapabilityResponse, requireUserId } from "@/lib/api/helpers"
import { errorResponse, HttpError } from "@/lib/api/http-error"
import { auditClientMeta, writeAuditLog } from "@/lib/admin/audit"
import { getDefaultLocaleId } from "@/lib/cms/queries"
import { isReservedSlug, isValidSlug, routeForEntry, slugFromTitle } from "@/lib/cms/slugs"
import { sanitizeCmsHtml } from "@/lib/cms/sanitize"

const createSchema = z.object({
  entryType: z.enum(["page", "article"]),
  title: z.string().min(1).max(200),
  slug: z.string().optional(),
  excerpt: z.string().max(500).optional(),
  body: z.string().optional(),
  heroMediaId: z.string().nullable().optional(),
})

async function requireEditor() {
  const userId = await requireUserId()
  if (userId instanceof Response) return userId
  const allowed = await requireCapabilityResponse(userId, "moderate")
  if (allowed instanceof Response) return allowed
  return userId
}

export async function GET() {
  try {
    const auth = await requireEditor()
    if (auth instanceof Response) return auth
    const entries = await db.select().from(cmsEntries).orderBy(desc(cmsEntries.updatedAt))
    return jsonOk({ entries })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function POST(request: Request) {
  try {
    const userId = await requireEditor()
    if (userId instanceof Response) return userId
    const parsed = createSchema.parse(await request.json())
    const slug = isValidSlug(parsed.slug) ? parsed.slug! : slugFromTitle(parsed.title)
    if (!slug || isReservedSlug(slug)) {
      throw new HttpError(400, "Invalid or reserved slug")
    }
    const localeId = await getDefaultLocaleId()
    if (!localeId) throw new HttpError(500, "Default locale is missing. Run db:migrate.")

    const id = crypto.randomUUID()
    const routePath = routeForEntry(parsed.entryType, slug)
    const body = sanitizeCmsHtml(parsed.body ?? "")

    await db.insert(cmsEntries).values({
      id,
      entryType: parsed.entryType,
      localeId,
      slug,
      routePath,
      title: parsed.title,
      excerpt: parsed.excerpt ?? null,
      body,
      heroMediaId: parsed.heroMediaId ?? null,
      status: "draft",
      createdByUserId: userId,
      updatedByUserId: userId,
    })

    await db.insert(cmsRevisions).values({
      id: crypto.randomUUID(),
      entryId: id,
      revisionNumber: 1,
      snapshot: { title: parsed.title, slug, body, excerpt: parsed.excerpt ?? null, heroMediaId: parsed.heroMediaId ?? null },
      createdByUserId: userId,
    })

    if (parsed.heroMediaId) {
      await db.insert(mediaUsages).values({
        id: crypto.randomUUID(),
        assetId: parsed.heroMediaId,
        entityType: "cms_entry",
        entityId: id,
        fieldKey: "hero",
        sortOrder: 0,
      })
    }

    await writeAuditLog({
      actorUserId: userId,
      action: "create",
      entityType: "cms_entry",
      entityId: id,
      ...auditClientMeta(request),
    })
    return jsonOk({ id, slug, routePath })
  } catch (error) {
    return errorResponse(error)
  }
}
