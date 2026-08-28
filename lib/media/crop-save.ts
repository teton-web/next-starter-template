export type CropSaveMode = "replace" | "create"

export function cropSaveMode(usageCount: number): CropSaveMode {
  return usageCount > 0 ? "create" : "replace"
}

export function cropDerivativeFilename(safeFilename: string) {
  if (/[-_]crop(\.[^.]+)?$/i.test(safeFilename)) return safeFilename
  const dot = safeFilename.lastIndexOf(".")
  if (dot <= 0) return `${safeFilename}-crop`
  return `${safeFilename.slice(0, dot)}-crop${safeFilename.slice(dot)}`
}
