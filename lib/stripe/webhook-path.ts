export function isStripeWebhookPath(pathname: string) {
  return pathname === "/api/stripe/webhook" || pathname === "/api/stripe/webhook/"
}
