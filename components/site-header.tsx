import Link from "next/link"
import { siteName } from "@/lib/site-visibility"

const primaryNav = [
  { href: "/", label: "Home" },
  { href: "/articles", label: "Articles" },
  { href: "/contact", label: "Contact" },
] as const

export function SiteHeader() {
  const name = siteName()

  return (
    <header className="border-b bg-background">
      <div className="mx-auto flex min-h-14 max-w-5xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-2">
        <div className="flex min-w-0 flex-wrap items-center gap-x-6 gap-y-2">
          <Link href="/" className="truncate font-semibold tracking-tight">
            {name}
          </Link>
          <nav aria-label="Primary" className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            {primaryNav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={
                  item.href === "/"
                    ? "hidden text-muted-foreground transition-colors hover:text-foreground sm:inline"
                    : "text-muted-foreground transition-colors hover:text-foreground"
                }
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
        <Link
          href="/login"
          className="shrink-0 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          Sign in
        </Link>
      </div>
    </header>
  )
}
