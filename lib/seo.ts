import { getCanonicalSiteUrl, isSearchIndexingAllowed, siteName } from "@/lib/site-visibility"

export function absoluteUrl(path = "/"): string {
  const origin = getCanonicalSiteUrl()
  if (path === "/" || path === "") return origin
  return `${origin}${path.startsWith("/") ? path : `/${path}`}`
}

export function buildPageAlternates(path = "/") {
  const canonical = absoluteUrl(path)
  return {
    alternates: {
      canonical,
    },
  }
}

export function buildPageOpenGraph(path: string, title?: string, description?: string) {
  const name = siteName()
  const url = absoluteUrl(path)
  return {
    openGraph: {
      type: "website" as const,
      locale: "en_US",
      url,
      siteName: name,
      title: title || name,
      description: description || undefined,
      images: [{ url: absoluteUrl("/opengraph-image"), alt: name }],
    },
    twitter: {
      card: "summary_large_image" as const,
      title: title || name,
      description: description || undefined,
      images: [absoluteUrl("/opengraph-image")],
    },
  }
}

export function indexingMetadata() {
  const index = isSearchIndexingAllowed()
  return {
    robots: {
      index,
      follow: index,
    },
  }
}

export function noindexMetadata() {
  return {
    robots: {
      index: false,
      follow: false,
      nocache: true,
      googleBot: {
        index: false,
        follow: false,
        noimageindex: true,
      },
    },
  }
}

export function organizationJsonLd() {
  const name = siteName()
  const url = getCanonicalSiteUrl()
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name,
    url,
  }
}

export function websiteJsonLd() {
  const name = siteName()
  const url = getCanonicalSiteUrl()
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name,
    url,
  }
}
