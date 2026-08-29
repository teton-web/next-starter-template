import { NextRequest } from "next/server"
import { isEnabled } from "@/lib/flags/resolve"
import { waitlistPostResponse } from "@/lib/waitlist/signup"

export async function POST(request: NextRequest) {
  return waitlistPostResponse(request, await isEnabled("waitlist"))
}
