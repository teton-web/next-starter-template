import { expect, test } from "@playwright/test"

const email = (process.env.SEED_ADMIN_EMAIL || "admin@example.com").trim().toLowerCase()
const password = process.env.SEED_ADMIN_PASSWORD || "changeme-admin-password"

test("seed admin login then CMS publish is public", async ({ page }) => {
  const stamp = Date.now()
  const title = `e2e-smoke-${stamp}`
  const routePath = `/${title}`

  await page.goto("/login?callbackUrl=/admin/content")
  await page.getByLabel("Email").fill(email)
  await page.getByLabel("Password").fill(password)
  await page.getByRole("button", { name: "Sign In" }).click()

  await expect(page, "login must succeed").not.toHaveURL(/\/login/)
  if (/\/admin\/account/.test(page.url())) {
    throw new Error(
      "Seed admin still has mustChangePassword=true. Re-seed with SEED_ADMIN_MUST_CHANGE_PASSWORD=false.",
    )
  }
  await expect(page).toHaveURL(/\/admin\/content/)
  await expect(page.getByRole("heading", { name: "Content" })).toBeVisible()
  await expect(page.getByText(email)).toBeVisible()

  await page.getByPlaceholder("Title").fill(title)
  const created = page.waitForResponse((response) => {
    return response.url().includes("/api/admin/cms") && response.request().method() === "POST"
  })
  await page.getByRole("button", { name: "Create draft" }).click()
  expect((await created).ok(), "create draft").toBeTruthy()

  const row = page.locator("li").filter({ hasText: title })
  await expect(row).toContainText("draft")
  await row.getByRole("link", { name: "Edit" }).click()

  await expect(page.getByRole("heading", { name: new RegExp(`Edit ${routePath}`) })).toBeVisible()
  const published = page.waitForResponse((response) => {
    return response.url().includes("/api/admin/cms/") && response.request().method() === "PATCH"
  })
  await page.getByRole("button", { name: "Publish", exact: true }).click()
  expect((await published).ok(), "publish").toBeTruthy()
  await expect(page.getByText("Saved (published)")).toBeVisible()

  const publicResponse = await page.request.get(routePath)
  expect(publicResponse.status(), `GET ${routePath}`).toBe(200)
  expect(await publicResponse.text()).toContain(title)
})
