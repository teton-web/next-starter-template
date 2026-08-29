export function isUniqueViolation(error: unknown): boolean {
  let current: unknown = error
  for (let depth = 0; depth < 4 && current && typeof current === "object"; depth += 1) {
    if ("code" in current && String((current as { code: unknown }).code) === "23505") {
      return true
    }
    current = "cause" in current ? (current as { cause: unknown }).cause : undefined
  }
  return false
}
