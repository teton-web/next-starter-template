import { describe, expect, test } from "bun:test"
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"

// WCP public-ship: .github/workflows/ci.yml is absent from the public template (public-main)

const root = join(import.meta.dir, "..")

function read(rel: string) {
  return readFileSync(join(root, rel), "utf8")
}

describe("Playwright smoke wiring", () => {
  test("package.json has a pinned e2e script and playwright dep", () => {
    const pkg = JSON.parse(read("package.json")) as {
      scripts: Record<string, string>
      devDependencies: Record<string, string>
      dependencies: Record<string, string>
    }
    expect(pkg.scripts.e2e).toBe("playwright test")
    expect(pkg.scripts.test).toBe("bun test tests")
    const bunfig = read("bunfig.toml")
    expect(bunfig).toContain('root = "tests"')
    expect(bunfig).toContain('pathIgnorePatterns = ["e2e/**"]')
    expect(pkg.devDependencies["@playwright/test"]).toBeTruthy()
    expect(pkg.devDependencies["@playwright/test"]).not.toBe("latest")
    expect(pkg.dependencies.pg).toBeTruthy()
  })

  test("playwright config is chromium-only and prefers build+start", () => {
    const config = read("playwright.config.ts")
    expect(config).toContain('testDir: "./e2e"')
    expect(config).toContain('testMatch: "auth-cms.spec.ts"')
    expect(config).toContain('name: "chromium"')
    expect(config).not.toContain("firefox")
    expect(config).not.toContain("webkit")
    expect(config).toContain("bun run build && bun run start")
    expect(config).toContain("bun run start")
  })

  test("one smoke spec covers login, draft, publish, public GET", () => {
    expect(existsSync(join(root, "e2e/auth-cms.spec.ts"))).toBe(true)
    const spec = read("e2e/auth-cms.spec.ts")
    expect(spec).toContain('getByLabel("Email")')
    expect(spec).toContain('getByLabel("Password")')
    expect(spec).toContain('getByRole("button", { name: "Sign In" })')
    expect(spec).toContain('toHaveURL(/\\/admin\\/content/)')
    expect(spec).toContain("login must succeed")
    expect(spec).toContain("Create draft")
    expect(spec).toContain('name: "Publish", exact: true')
    expect(spec).toContain("SEED_ADMIN_MUST_CHANGE_PASSWORD")
    expect(spec).toContain("publicResponse.status()")
    expect(spec).toContain("toBe(200)")
  })

  test("gitignore covers playwright output", () => {
    const gitignore = read(".gitignore")
    expect(gitignore).toContain("/test-results/")
    expect(gitignore).toContain("/playwright-report/")
    expect(gitignore).toContain("/blob-report/")
    expect(gitignore).toContain("/playwright/.cache/")
  })

  test("the template ships no GitHub Actions workflow", () => {
    expect(existsSync(join(root, ".github/workflows/ci.yml"))).toBe(false)
    expect(existsSync(join(root, ".github/workflows"))).toBe(false)
  })
})
