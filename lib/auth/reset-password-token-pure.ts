export function resetPasswordTokenFromCtx(ctx: {
  body?: { token?: unknown } | null
  query?: { token?: unknown } | null
}): string {
  const bodyToken = ctx.body?.token
  if (typeof bodyToken === "string" && bodyToken.length > 0) {
    return bodyToken
  }
  const queryToken = ctx.query?.token
  if (typeof queryToken === "string" && queryToken.length > 0) {
    return queryToken
  }
  return ""
}
