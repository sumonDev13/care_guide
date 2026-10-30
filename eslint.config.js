import tseslint from "typescript-eslint";

/**
 * Root ESLint (flat) configuration. Workspace apps extend this behavior via
 * their own configs when they are scaffolded; imported-asset/JSX globals will
 * be enabled in the frontend workspace where they are relevant.
 */
export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/build/**",
      "**/.next/**",
      "**/out/**",
      "**/coverage/**",
      "**/mongo-data/**",
    ],
  },
  ...tseslint.configs.recommended,
);
