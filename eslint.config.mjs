import nextCoreWebVitals from "eslint-config-next/core-web-vitals"
import nextTypescript from "eslint-config-next/typescript"

const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "react/no-unescaped-entities": "warn",
      "prefer-const": "warn",
    },
  },
  {
    ignores: [".next/**", "node_modules/**", "drizzle/**", "e2e/**", "playwright-report/**", "test-results/**"],
  },
]

export default eslintConfig
