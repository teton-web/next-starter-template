export function staticPublicSitemapPaths(flags: {
  waitlistEnabled: boolean
  galleriesEnabled: boolean
  stripeEnabled: boolean
}) {
  return [
    "/",
    "/contact",
    "/privacy",
    "/terms",
    "/articles",
    ...(flags.waitlistEnabled ? ["/waitlist"] : []),
    ...(flags.galleriesEnabled ? ["/gallery"] : []),
    ...(flags.stripeEnabled ? ["/pay"] : []),
  ]
}
