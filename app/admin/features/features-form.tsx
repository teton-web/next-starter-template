"use client"

import type React from "react"
import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import type { FlagStatus } from "@/lib/flags/status"

type FeaturesResponse = {
  flags?: FlagStatus[]
  flag?: FlagStatus
  error?: string
}

export function FeaturesForm({ initialFlags }: { initialFlags: FlagStatus[] }) {
  const [flags, setFlags] = useState(initialFlags)
  const [error, setError] = useState("")
  const [pendingKey, setPendingKey] = useState<string | null>(null)
  const [siteGatePassword, setSiteGatePassword] = useState("")

  const optionalFlags = useMemo(() => flags.filter((flag) => !flag.platform), [flags])
  const platformFlags = useMemo(() => flags.filter((flag) => flag.platform), [flags])

  async function patchFlag(payload: { key: string; enabled?: boolean; password?: string }) {
    setError("")
    setPendingKey(payload.key)
    try {
      const response = await fetch("/api/admin/features", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const body = (await response.json().catch(() => ({}))) as FeaturesResponse
      if (!response.ok) {
        setError(typeof body.error === "string" ? body.error : "Unable to update feature flag.")
        return
      }
      if (Array.isArray(body.flags)) {
        setFlags(body.flags)
      }
      if (payload.password) {
        setSiteGatePassword("")
      }
    } finally {
      setPendingKey(null)
    }
  }

  function switchChecked(flag: FlagStatus) {
    if (flag.platform) return true
    if (flag.lockedOff) return false
    return flag.storedEnabled === true
  }

  return (
    <div className="space-y-8">
      {error ? (
        <div role="alert" className="text-sm text-red-500">
          {error}
        </div>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Optional</h2>
        <ul className="divide-y rounded-lg border">
          {optionalFlags.map((flag) => {
            const pending = pendingKey === flag.key
            return (
              <li key={flag.key} className="space-y-3 px-4 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <Label htmlFor={`flag-${flag.key}`} className="text-base">
                      {flag.label}
                    </Label>
                    <p className="text-xs text-muted-foreground">{flag.key}</p>
                    {flag.reasons.map((reason) => (
                      <p key={reason} className="text-sm text-muted-foreground">
                        {reason}
                      </p>
                    ))}
                    {flag.lockedOff ? (
                      <p className="text-sm text-amber-800 dark:text-amber-200">
                        Enabling is blocked while the Doppler kill switch is set.
                      </p>
                    ) : null}
                  </div>
                  <Switch
                    id={`flag-${flag.key}`}
                    checked={switchChecked(flag)}
                    disabled={!flag.toggleable || pending}
                    onCheckedChange={(checked) => {
                      void patchFlag({ key: flag.key, enabled: checked })
                    }}
                  />
                </div>
                {flag.key === "site_gate" ? (
                  <form
                    className="flex max-w-md flex-col gap-2 sm:flex-row sm:items-end"
                    onSubmit={(event: React.FormEvent) => {
                      event.preventDefault()
                      void patchFlag({
                        key: "site_gate",
                        password: siteGatePassword,
                      })
                    }}
                  >
                    <div className="flex-1 space-y-2">
                      <Label htmlFor="site-gate-password">
                        {flag.hasPassword ? "Replace site-gate password" : "Site-gate password"}
                      </Label>
                      <Input
                        id="site-gate-password"
                        type="password"
                        autoComplete="new-password"
                        value={siteGatePassword}
                        onChange={(event) => setSiteGatePassword(event.target.value)}
                        disabled={pending}
                      />
                      <p className="text-xs text-muted-foreground">
                        {flag.hasPassword
                          ? "A password hash is stored. It is never shown again."
                          : "Saving stores a hash. Turning the flag on without a password keeps the gate dark."}
                      </p>
                    </div>
                    <Button type="submit" variant="outline" disabled={pending || siteGatePassword.trim().length === 0}>
                      Save password
                    </Button>
                  </form>
                ) : null}
              </li>
            )
          })}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Platform</h2>
        <ul className="divide-y rounded-lg border">
          {platformFlags.map((flag) => (
            <li key={flag.key} className="flex items-start justify-between gap-4 px-4 py-4">
              <div className="space-y-1">
                <Label htmlFor={`flag-${flag.key}`} className="text-base">
                  {flag.label}
                </Label>
                <p className="text-xs text-muted-foreground">{flag.key}</p>
                {flag.reasons.map((reason) => (
                  <p key={reason} className="text-sm text-muted-foreground">
                    {reason}
                  </p>
                ))}
              </div>
              <Switch id={`flag-${flag.key}`} checked disabled />
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
