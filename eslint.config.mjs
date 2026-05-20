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
    // Local SSH-deploy helpers (Node + Python). They use Node's CommonJS
    // `require()` API, which trips the Next.js lint preset; they aren't
    // application code and aren't shipped to the bundle.
    ".deploy/**",
    "scripts/**",
    "node_modules/**",
  ]),
]);

export default eslintConfig;
