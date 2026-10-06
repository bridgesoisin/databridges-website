import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Agent worktrees are full repo copies; never lint them.
    ".claude/**",
    // Vendored, pre-built Decap CMS bundle (public/admin) — minified,
    // single-line, ~5MB; not our code and chokes ESLint's parser.
    "public/admin/decap-cms.js",
    // Generated, git-ignored output (scan reports and the built agent pack).
    "reports/**",
  ]),
]);

export default eslintConfig;
