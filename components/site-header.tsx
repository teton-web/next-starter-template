import Link from "next/link"
import { siteName } from "@/lib/site-visibility"

const primaryNav = [
  { href: "/", label: "Home" },
  { href: "/articles", label: "Articles" },
  { href: "/gallery", label: "Gallery", flag: "galleries" },
  { href: "/waitlist", label: "Waitlist", flag: "waitlist" },
  { href: "/contact", label: "Contact" },
] as const

export function SiteHeader({
  waitlistEnabled = false,
  galleriesEnabled = false,
}: {
  waitlistEnabled?: boolean
  galleriesEnabled?: boolean
}) {
  const name = siteName()
  const nav = primaryNav.filter((item) => {
    if (!("flag" in item)) return true
    if (item.flag === "waitlist") return waitlistEnabled
    if (item.flag === "galleries") return galleriesEnabled
    return false
  })

  return (
    <header className="border-b bg-background">
      <div className="mx-auto flex min-h-14 max-w-5xl flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2">
        <Link
          href="/"
          className="mr-auto inline-flex h-9 min-w-0 items-center truncate font-semibold tracking-tight"
        >
          {name}
        </Link>
        <nav
          aria-label="Primary"
          className="order-last flex w-full flex-wrap items-center gap-x-4 gap-y-1 text-sm sm:order-none sm:w-auto"
        >
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={
                item.href === "/"
                  ? "hidden h-9 items-center text-muted-foreground transition-colors hover:text-foreground sm:inline-flex"
                  : "inline-flex h-9 items-center text-muted-foreground transition-colors hover:text-foreground"
              }
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <Link
          href="/login"
          className="inline-flex h-9 shrink-0 items-center text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          Sign in
        </Link>
      </div>
    </header>
  )
}
