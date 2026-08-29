import { NextRequest } from "next/server"
import { isEnabled } from "@/lib/flags/resolve"
import { stripeCheckoutPostResponse } from "@/lib/stripe/checkout"

export async function POST(request: NextRequest) {
  return stripeCheckoutPostResponse(request, { enabled: await isEnabled("stripe") })
}
