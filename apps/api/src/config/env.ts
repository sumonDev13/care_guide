import dotenv from "dotenv";
import { existsSync } from "node:fs";
import path from "node:path";
import { z } from "zod";

// A single monorepo .env at the repository root (documented in .env.example) is
// the one source of runtime configuration for backend and frontend alike.
// Loading is a no-op in CI/test environments, where values come from the
// process environment (vitest test env) — dotenv never overrides existing vars.
const repoRootEnvPath = path.resolve(import.meta.dirname, "../../../.env");
if (existsSync(repoRootEnvPath)) {
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
});

export type ApiEnv = {
  nodeEnv: "development" | "test" | "production";
  port: number;
  logLevel: "fatal" | "error" | "warn" | "info" | "debug" | "trace" | "silent";
  corsOrigins: string[];
  rateLimitWindowMinutes: number;
  rateLimitMaxRequests: number;
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
};

export const isProd = env.nodeEnv === "production";
export const isTest = env.nodeEnv === "test";
