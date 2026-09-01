"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

export function ContactForm() {
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle")
  const [error, setError] = useState("")

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setStatus("sending")
    setError("")
    const form = new FormData(event.currentTarget)
    const response = await fetch("/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.get("name"),
        email: form.get("email"),
        message: form.get("message"),
      }),
    })
    if (!response.ok) {
      const body = await response.json().catch(() => ({}))
      setError(body.error || "Could not send message")
      setStatus("error")
      return
    }
    setStatus("sent")
    event.currentTarget.reset()
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 space-y-4">
      <div className="space-y-2">
        <label htmlFor="name" className="text-sm font-medium">Name</label>
        <Input id="name" name="name" required />
      </div>
      <div className="space-y-2">
        <label htmlFor="email" className="text-sm font-medium">Email</label>
        <Input id="email" name="email" type="email" required />
      </div>
      <div className="space-y-2">
        <label htmlFor="message" className="text-sm font-medium">Message</label>
        <Textarea id="message" name="message" required minLength={10} rows={6} />
      </div>
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      {status === "sent" ? <p role="status" className="text-sm text-green-600">Message sent.</p> : null}
      <Button type="submit" disabled={status === "sending"}>
        {status === "sending" ? "Sending…" : "Send"}
      </Button>
    </form>
  )
}
