export function CmsDocument({
  title,
  body,
  heroUrl,
  heroAlt,
}: {
  title: string
  body: string
  heroUrl?: string | null
  heroAlt?: string | null
}) {
  return (
    <article className="mx-auto max-w-2xl px-4 py-16">
      {heroUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={heroUrl} alt={heroAlt ?? ""} className="mb-8 w-full rounded-lg" />
      ) : null}
      <h1 className="text-4xl font-bold">{title}</h1>
      <div className="mt-8 space-y-4" dangerouslySetInnerHTML={{ __html: body }} />
    </article>
  )
}
