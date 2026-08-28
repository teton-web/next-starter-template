"use client"

import type React from "react"
import { useState } from "react"
import useSWR from "swr"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { formatDashboardDate } from "@/lib/admin/dashboard-pure"
import type { Capability } from "@/lib/auth/capabilities-pure"

type AdminUser = {
  id: string
  email: string
  name: string
  capabilities: Capability[]
  createdAt: string | Date
}

const fetcher = (url: string) => fetch(url).then((r) => r.json())

function toggleCapability(current: Capability[], cap: Capability, checked: boolean): Capability[] {
  const next = new Set(current)
  if (checked) next.add(cap)
  else next.delete(cap)
  return Array.from(next)
}

export default function AdminUsersPage() {
  const { data, mutate } = useSWR("/api/admin/users", fetcher)
  const users: AdminUser[] = data?.users ?? []
  const forbidden = Boolean(data?.error) && !data?.users
  const adminCount = users.filter((user) => user.capabilities.includes("admin")).length

  const [email, setEmail] = useState("")
  const [name, setName] = useState("")
  const [inviteCaps, setInviteCaps] = useState<Capability[]>(["moderate"])
  const [error, setError] = useState("")
  const [pending, setPending] = useState(false)

  async function inviteUser(event: React.FormEvent) {
    event.preventDefault()
    setError("")
    setPending(true)
    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name, capabilities: inviteCaps }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) {
        setError(typeof body.error === "string" ? body.error : "Unable to complete this invite.")
        return
      }
      setEmail("")
      setName("")
      setInviteCaps(["moderate"])
      await mutate()
    } finally {
      setPending(false)
    }
  }

  async function patchUser(id: string, payload: { capabilities?: string[]; deletedAt?: true }) {
    setError("")
    const response = await fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
    const body = await response.json().catch(() => ({}))
    if (!response.ok) {
      setError(typeof body.error === "string" ? body.error : "Unable to update user.")
      return
    }
    await mutate()
  }

  if (forbidden) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold">Users</h1>
        <p className="mt-2 text-sm text-muted-foreground">You need admin access to manage users.</p>
      </div>
    )
  }

  return (
    <div className="container mx-auto space-y-8 px-4 py-8">
      <h1 className="text-2xl font-bold">Users</h1>

      <form onSubmit={inviteUser} className="max-w-xl space-y-4 rounded-lg border p-4">
        <h2 className="text-lg font-semibold">Invite</h2>
        <div className="space-y-2">
          <Label htmlFor="invite-email">Email</Label>
          <Input
            id="invite-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={pending}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="invite-name">Name</Label>
          <Input
            id="invite-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            disabled={pending}
          />
        </div>
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Capabilities</legend>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={inviteCaps.includes("admin")}
              onChange={(e) => setInviteCaps(toggleCapability(inviteCaps, "admin", e.target.checked))}
              disabled={pending}
            />
            admin
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={inviteCaps.includes("moderate")}
              onChange={(e) => setInviteCaps(toggleCapability(inviteCaps, "moderate", e.target.checked))}
              disabled={pending}
            />
            moderate
          </label>
        </fieldset>
        {error ? (
          <div role="alert" className="text-sm text-red-500">
            {error}
          </div>
        ) : null}
        <Button type="submit" disabled={pending}>
          {pending ? "Inviting…" : "Invite"}
        </Button>
      </form>

      <ul className="divide-y rounded-lg border">
        {users.length === 0 ? (
          <li className="px-4 py-3 text-sm text-muted-foreground">No users yet.</li>
        ) : (
          users.map((user) => {
            const isLastAdmin = user.capabilities.includes("admin") && adminCount <= 1
            return (
              <li key={user.id} className="flex flex-wrap items-center justify-between gap-4 px-4 py-3">
                <div>
                  <p className="font-medium">{user.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {user.email} · {formatDashboardDate(user.createdAt)}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-3 text-sm">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={user.capabilities.includes("admin")}
                        disabled={isLastAdmin}
                        title={isLastAdmin ? "Cannot remove the last remaining admin." : undefined}
                        onChange={(e) =>
                          patchUser(user.id, {
                            capabilities: toggleCapability(user.capabilities, "admin", e.target.checked),
                          })
                        }
                      />
                      admin
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={user.capabilities.includes("moderate")}
                        onChange={(e) =>
                          patchUser(user.id, {
                            capabilities: toggleCapability(user.capabilities, "moderate", e.target.checked),
                          })
                        }
                      />
                      moderate
                    </label>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isLastAdmin}
                  onClick={() => patchUser(user.id, { deletedAt: true })}
                >
                  Disable
                </Button>
              </li>
            )
          })
        )}
      </ul>
    </div>
  )
}
