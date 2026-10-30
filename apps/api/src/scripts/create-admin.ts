/**
 * Initial administrator creation — the documented, deliberately NON-HTTP
 * bootstrap path (no public registration endpoint exists, so this script is
 * the single way an admin ever comes into existence).
 *
 *   Interactive:   npm run create-admin -w apps/api
 *   Scripted/CI:   npm run create-admin -w apps/api -- \
 *                    --name "Ops Admin" --email ops@example.com \
 *                    --password-env ADMIN_BOOTSTRAP_PASSWORD
 *
 *   (In the scripted mode the password must already sit in that environment
 *   variable: `export ADMIN_BOOTSTRAP_PASSWORD=...` in a shell that owns the
 *   secret — never in argv, where command history would capture it.)
 *
 * The password is hashed with argon2id in-process; neither the plaintext nor
 * the hash is ever printed on success.
 */
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import type { ReadStream } from "node:tty";
import { AdminModel } from "../models/admin.model.js";
import { hashPassword } from "../services/auth.service.js";
import { connectDatabase, disconnectDatabase, describeMongoUri } from "../config/mongodb.js";
import { env } from "../config/env.js";
import { logger } from "../middleware/request-logger.js";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 12;

function argValue(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  if (index === -1) return undefined;
  const value = process.argv[index + 1];
  if (value === undefined || value.startsWith("--")) {
    throw new Error(`Flag ${flag} requires a value`);
  }
  return value;
}

async function readHidden(input: ReadStream, prompt: string): Promise<string> {
  stdout.write(prompt);
  return new Promise((resolve, reject) => {
    input.setRawMode?.(true);
    let buffer = "";
    const onData = (chunk: Buffer) => {
      const text = chunk.toString("utf8");
      if (text.includes("\u0003")) {
        // Ctrl+C: restore terminal state visibly.
        input.setRawMode?.(false);
        stdout.write("\n");
        reject(new Error("Cancelled"));
        return;
      }
      if (text === "\r" || text === "\n") {
        input.setRawMode?.(false);
        input.pause();
        stdout.write("\n");
        input.removeListener("data", onData);
        resolve(buffer);
        return;
      }
      if (text === "\u0008" || text === "\u007f") {
        buffer = buffer.slice(0, -1);
        return;
      }
      buffer += text;
    };
    input.resume();
    input.on("data", onData);
  });
}

async function main(): Promise<void> {
  const rl = createInterface({ input: stdin, output: stdout });
  const isInteractive = stdin.isTTY === true;

  const emailArg = argValue("--email");
  const nameArg = argValue("--name");
  const passwordEnvName = argValue("--password-env");

  stdout.write(`Creating an administrator on ${describeMongoUri(env.mongodbUri ?? "")}\n`);

  let email = emailArg ?? (isInteractive ? await rl.question("Admin email: ") : undefined);
  if (!email) throw new Error("Run interactively (email/password prompts) or pass --email and --password-env");
  email = email.trim().toLowerCase();
  if (!EMAIL_PATTERN.test(email)) throw new Error(`"${email}" is not a valid email address`);

  let name = nameArg;
  if (!name && isInteractive) name = (await rl.question("Admin display name: ")).trim();
  if (!name) name = email.split("@")[0] ?? email;
  if (name.length < 2) throw new Error("Display name is too short");

  let password: string | undefined;
  if (passwordEnvName) {
    const supplied = process.env[passwordEnvName];
    if (!supplied) throw new Error(`Environment variable ${passwordEnvName} is not set`);
    password = supplied;
  } else if (isInteractive) {
    password = await readHidden(stdin as ReadStream, "Password (input hidden, min 12 chars): ");
  }
  if (!password) throw new Error("No password supplied — use --password-env in non-interactive shells");
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
  }

  await connectDatabase();

  const existing = await AdminModel.exists({ email });
  if (existing) {
    throw new Error(`An administrator with email ${email} already exists`);
  }

  await AdminModel.create({ name, email, passwordHash: await hashPassword(password) });

  logger.info({ email, database: describeMongoUri(env.mongodbUri ?? "") }, "Administrator created");
  rl.close();
  await disconnectDatabase();
}

const isDirectRun = process.argv[1]?.endsWith("create-admin.ts") || process.argv[1]?.startsWith("create-admin.js");
if (isDirectRun) {
  main().catch(async (err) => {
    logger.error({ message: err instanceof Error ? err.message : String(err) }, "create-admin failed");
    await disconnectDatabase();
    process.exit(1);
  });
}
