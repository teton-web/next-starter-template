"use client"

import type React from "react"

import { useSession, signOut } from "@/lib/auth-client"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { LogOut, Home } from "lucide-react"
import Link from "next/link"

export function AdminShell({
  canAdmin,
  galleriesEnabled = false,
  children,
}: {
  canAdmin: boolean
  galleriesEnabled?: boolean
  children: React.ReactNode
}) {
  const { data: session, isPending } = useSession()
  const router = useRouter()

  const handleSignOut = async () => {
    await signOut()
    router.push("/login")
  }

  if (isPending) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold">Admin</h1>
            <Link href="/admin/content" className="text-sm hover:underline">Content</Link>
            <Link href="/admin/media" className="text-sm hover:underline">Media</Link>
            {galleriesEnabled ? (
              <Link href="/admin/media/gallery" className="text-sm hover:underline">
                Galleries
              </Link>
            ) : null}
            <Link href="/admin/users" className="text-sm hover:underline">Users</Link>
            <Link href="/admin/audit" className="text-sm hover:underline">Audit</Link>
            {canAdmin ? (
              <Link href="/admin/features" className="text-sm hover:underline">
                Features
              </Link>
            ) : null}
            {canAdmin ? (
              <Link href="/admin/waitlist" className="text-sm hover:underline">
                Waitlist
              </Link>
            ) : null}
            <Link href="/admin/account" className="text-sm hover:underline">Account</Link>
            <Link href="/">
              <Button variant="outline" size="sm">
                <Home className="w-4 h-4 mr-2" />
                View Site
              </Button>
            </Link>
          </div>
          <div className="flex items-center gap-4">
            {session?.user && (
              <>
                <span className="text-sm text-muted-foreground">{session.user.email}</span>
                <Button variant="outline" size="sm" onClick={handleSignOut}>
                  <LogOut className="w-4 h-4 mr-2" />
                  Sign Out
                </Button>
              </>
            )}
          </div>
        </div>
      </header>
      {children}
    </div>
  )
}
