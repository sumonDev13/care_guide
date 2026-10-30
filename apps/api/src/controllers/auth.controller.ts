import type { Request, Response } from "express";
import { loginSchema } from "../validators/auth.validators.js";
import {
  authenticateCredentials,
  findAdminSummary,
} from "../services/auth.service.js";
import {
  SESSION_COOKIE_NAME,
  createSession,
  destroySession,
} from "../services/session.service.js";
import { ApiError } from "../utils/errors.js";
import { sendSuccess } from "../utils/http-response.js";
import { env, isProd } from "../config/env.js";

const LOGIN_ERROR_MESSAGE = "Invalid email or password."; // deliberate uniformity

function sessionCookieOptions(maxAgeMs?: number) {
  return {
    httpOnly: true,
    sameSite: "strict" as const,
    secure: isProd,
    path: "/",
    ...(maxAgeMs !== undefined ? { maxAge: maxAgeMs } : {}),
  };
}

export async function login(req: Request, res: Response): Promise<void> {
  const credentials = loginSchema.parse(req.body);
  const admin = await authenticateCredentials(credentials);

  if (!admin) {
    throw ApiError.unauthorized(LOGIN_ERROR_MESSAGE);
  }

  const session = await createSession(admin.id);
  res.cookie(SESSION_COOKIE_NAME, session.token, sessionCookieOptions(env.authSessionTtlMinutes * 60 * 1000));

  sendSuccess(res, {
    admin: { id: String(admin.id), name: admin.name, email: admin.email },
  });
}

export async function logout(req: Request, res: Response): Promise<void> {
  const token = req.cookies?.[SESSION_COOKIE_NAME];
  if (token) {
    await destroySession(token); // revocation is server-side, not a client delete
  }
  res.clearCookie(SESSION_COOKIE_NAME, sessionCookieOptions());
  sendSuccess(res, { loggedOut: true });
}

export async function me(req: Request, res: Response): Promise<void> {
  const adminId = res.locals.adminId;
  const admin = await findAdminSummary(adminId);
  if (!admin) {
    // Session belongs to an account that no longer exists — invalid now.
    res.clearCookie(SESSION_COOKIE_NAME, sessionCookieOptions());
    throw ApiError.unauthorized(LOGIN_ERROR_MESSAGE);
  }
  sendSuccess(res, { admin });
}
