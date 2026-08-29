import { MetadataRoute } from "next"
import { getCanonicalSiteUrl } from "@/lib/site-visibility"
import { listPublishedEntries } from "@/lib/cms/queries"
import { isEnabled } from "@/lib/flags/resolve"

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = getCanonicalSiteUrl()
  const waitlistEnabled = await isEnabled("waitlist")
  const staticPaths = [
    "/",
    "/contact",
    "/privacy",
    "/terms",
    "/articles",
    ...(waitlistEnabled ? ["/waitlist"] : []),
  ]

  let cms: { url: string; lastModified: Date }[] = []
  try {
    const [pages, articles] = await Promise.all([
      listPublishedEntries("page"),
      listPublishedEntries("article"),
    ])
    cms = [...pages, ...articles].map((entry) => ({
      url: `${siteUrl}${entry.routePath}`,
      lastModified: entry.updatedAt,
    }))
  } catch {
    cms = []
  }

  return [
    ...staticPaths.map((path) => ({
      url: path === "/" ? siteUrl : `${siteUrl}${path}`,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: path === "/" ? 1 : 0.6,
    })),
    ...cms,
  ]
}
