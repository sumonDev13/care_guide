import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.spec.ts"],
    // Test runtime configuration. Preempts repository .env values so tests are
    // deterministic and quiet; dotenv never overrides existing process env.
    env: {
      NODE_ENV: "test",
      LOG_LEVEL: "silent",
    },
  },
});
