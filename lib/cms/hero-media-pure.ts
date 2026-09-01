export type HeroMediaOption = {
  id: string
  filename: string
}

const CURRENT_HERO_FALLBACK_FILENAME = "Current hero"

export function unionHeroMediaOption(
  assets: readonly HeroMediaOption[],
  heroMediaId: string | null | undefined,
  knownHero?: HeroMediaOption | null,
): HeroMediaOption[] {
  if (!heroMediaId) return [...assets]
  if (assets.some((asset) => asset.id === heroMediaId)) return [...assets]
  const filename =
    knownHero?.id === heroMediaId && knownHero.filename.trim()
      ? knownHero.filename
      : CURRENT_HERO_FALLBACK_FILENAME
  return [{ id: heroMediaId, filename }, ...assets]
}
