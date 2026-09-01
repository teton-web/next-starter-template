import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card"
import { siteName } from "@/lib/site-visibility"

export default function Home() {
  const name = siteName()

  return (
    <main className="flex items-center justify-center p-4 py-16">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <h1 className="text-4xl font-semibold leading-none">{name}</h1>
          <CardDescription className="text-lg">
            A Next.js starter with authentication, a CMS, and a public site ready to customize.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            Browse articles, send a message, or sign in if you operate this site.
          </p>
          <div className="flex flex-wrap gap-4 pt-2">
            <Button asChild>
              <Link href="/articles">Articles</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/contact">Contact</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/login">Sign in</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  )
}
