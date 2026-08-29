import { describe, expect, test } from "bun:test"
import { isReservedSlug, isValidSlug, routeForEntry, slugFromTitle } from "@/lib/cms/slugs"
import { canHardDeleteCmsEntry } from "@/lib/cms/delete-pure"
import { sanitizeCmsHtml } from "@/lib/cms/sanitize"

describe("cms slugs", () => {
  test("slugFromTitle normalizes titles", () => {
    expect(slugFromTitle("Hello World!")).toBe("hello-world")
  })

  test("reserved slugs cannot be CMS pages", () => {
    expect(isReservedSlug("admin")).toBe(true)
    expect(isReservedSlug("waitlist")).toBe(true)
    expect(isReservedSlug("gallery")).toBe(true)
    expect(isReservedSlug("pay")).toBe(true)
    expect(isReservedSlug("about")).toBe(false)
    expect(isValidSlug("about-us")).toBe(true)
    expect(isValidSlug("Nope")).toBe(false)
  })

  test("routeForEntry prefixes articles", () => {
    expect(routeForEntry("page", "about")).toBe("/about")
    expect(routeForEntry("article", "hello")).toBe("/articles/hello")
  })
})

describe("cms hard delete", () => {
  test("only drafts can be hard-deleted", () => {
    expect(canHardDeleteCmsEntry("draft")).toBe(true)
    expect(canHardDeleteCmsEntry("in_review")).toBe(false)
    expect(canHardDeleteCmsEntry("published")).toBe(false)
  })
})

describe("cms html sanitizer", () => {
  test("strips script tags", () => {
    expect(sanitizeCmsHtml('<p>Hi</p><script>alert(1)</script>')).toBe("<p>Hi</p>")
  })
})
