import dotenv from "dotenv";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";

/**
 * A single monorepo .env at the repository root (documented in .env.example) is
 * the one source of runtime configuration for backend and frontend alike.
 * Located by walking up from this module until a package manifest with a
 * `workspaces` field is found — layout-proofs the compiled dist/ tree too —
 * and loading is a no-op outside a repository checkout (process env only;
 * dotenv never overrides existing vars).
 */
function findRepoRootEnvPath(startDir: string): string | undefined {
  let dir = startDir;
  for (;;) {
    const manifestPath = path.join(dir, "package.json");
    if (existsSync(manifestPath)) {
      const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
        workspaces?: unknown;
      };
      if (manifest.workspaces !== undefined) return path.join(dir, ".env");
    }
    const parent = path.dirname(dir);
    if (parent === dir) return undefined;
    dir = parent;
  }
}

const repoRootEnvPath = findRepoRootEnvPath(import.meta.dirname);
if (repoRootEnvPath && existsSync(repoRootEnvPath)) {
  dotenv.config({ path: repoRootEnvPath, quiet: true });
}

/**
 * Validated application configuration.
 *
 * Strictly fail-fast: an invalid environment must never reach request
 * handling. Keys are added here as the feature that owns them is implemented
 * (unknown keys are tolerated meanwhile):
 *   - Step 3 wires MONGODB_URI / MONGODB_DB_NAME.
 *   - Step 5 wires AUTH_SESSION_TTL_MINUTES.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  API_PORT: z.coerce
    .number()
    .int()
    .min(1)
    .max(65535)
    .default(4000),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info"),
  CORS_ORIGINS: z
    .string()
    .min(1)
    .default("http://localhost:3000")
    .transform((value) =>
      value
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean),
    )
    .pipe(z.array(z.string().url()).min(1)),
  RATE_LIMIT_WINDOW_MINUTES: z.coerce.number().int().min(1).max(60).default(5),
  RATE_LIMIT_MAX_REQUESTS: z.coerce
    .number()
    .int()
    .min(1)
    .max(10_000)
    .default(300),
  MONGODB_URI: z
    .string()
    .optional()
    .refine(
      (value) => value === undefined || /^mongodb(\+srv)?:\/\//.test(value),
      { message: "must be a mongodb:// or mongodb+srv:// connection string" },
    ),
  MONGODB_DB_NAME: z.string().min(1).optional(),
  AUTH_SESSION_TTL_MINUTES: z.coerce.number().int().min(5).max(43_200).default(480),
  AUTH_LOGIN_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(100).default(8),
  AUTH_LOGIN_WINDOW_MINUTES: z.coerce.number().int().min(1).max(240).default(15),
})
.superRefine((data, ctx) => {
  // Test runs use mongodb-memory-server with a dynamically allocated URI, so
  // real connectivity config must not be demanded there. Everywhere else the
  // boot hard-fails — never boot a "working" API without its database.
  if (data.NODE_ENV === "test") return;
  if (!data.MONGODB_URI) {
    ctx.addIssue({
      code: "custom",
      path: ["MONGODB_URI"],
      message: "MONGODB_URI is required outside the test environment",
    });
  }
  if (!data.MONGODB_DB_NAME) {
    ctx.addIssue({
      code: "custom",
      path: ["MONGODB_DB_NAME"],
      message: "MONGODB_DB_NAME is required outside the test environment",
    });
  }
});

export type ApiEnv = {
  nodeEnv: "development" | "test" | "production";
  port: number;
  logLevel: "fatal" | "error" | "warn" | "info" | "debug" | "trace" | "silent";
  corsOrigins: string[];
  rateLimitWindowMinutes: number;
  rateLimitMaxRequests: number;
  mongodbUri?: string;
  mongodbDbName?: string;
  authSessionTtlMinutes: number;
  authLoginMaxAttempts: number;
  authLoginWindowMinutes: number;
};

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  const issues = parsed.error.issues
    .map((issue) => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`)
    .join("\n");
  console.error(`Invalid environment configuration:\n${issues}`);
  process.exit(1);
}

export const env: ApiEnv = {
  nodeEnv: parsed.data.NODE_ENV,
  port: parsed.data.API_PORT,
  logLevel: parsed.data.LOG_LEVEL,
  corsOrigins: parsed.data.CORS_ORIGINS,
  rateLimitWindowMinutes: parsed.data.RATE_LIMIT_WINDOW_MINUTES,
  rateLimitMaxRequests: parsed.data.RATE_LIMIT_MAX_REQUESTS,
  mongodbUri: parsed.data.MONGODB_URI,
  mongodbDbName: parsed.data.MONGODB_DB_NAME,
  authSessionTtlMinutes: parsed.data.AUTH_SESSION_TTL_MINUTES,
  authLoginMaxAttempts: parsed.data.AUTH_LOGIN_MAX_ATTEMPTS,
  authLoginWindowMinutes: parsed.data.AUTH_LOGIN_WINDOW_MINUTES,
};

export const isProd = env.nodeEnv === "production";
export const isTest = env.nodeEnv === "test";
