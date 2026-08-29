"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export function WaitlistForm() {
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle")
  const [error, setError] = useState("")

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setStatus("sending")
    setError("")
    const form = new FormData(event.currentTarget)
    const name = String(form.get("name") ?? "").trim()
    const response = await fetch("/api/waitlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: form.get("email"),
        ...(name ? { name } : {}),
        source: "waitlist",
      }),
    })
    if (!response.ok) {
      const body = await response.json().catch(() => ({}))
      setError(body.error || "Could not join the waitlist")
      setStatus("error")
      return
    }
    setStatus("sent")
    event.currentTarget.reset()
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 space-y-4">
      <div className="space-y-2">
        <label htmlFor="name" className="text-sm font-medium">
          Name <span className="font-normal text-muted-foreground">(optional)</span>
        </label>
        <Input id="name" name="name" autoComplete="name" maxLength={120} />
      </div>
      <div className="space-y-2">
        <label htmlFor="email" className="text-sm font-medium">
          Email
        </label>
        <Input id="email" name="email" type="email" required autoComplete="email" maxLength={320} />
      </div>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {status === "sent" ? (
        <p role="status" className="text-sm text-green-600">
          You&apos;re on the list.
        </p>
      ) : null}
      <Button type="submit" disabled={status === "sending"}>
        {status === "sending" ? "Joining…" : "Join waitlist"}
      </Button>
    </form>
  )
}
