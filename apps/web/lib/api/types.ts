/**
 * Wire mirrors of the API's response envelope and the session payload shapes
 * (apps/api/src/controllers/auth.controller.ts). Endpoint slices transform the
 * envelope away, so hooks receive the `data` payload directly.
 */

/** Every success reply: `{ success: true, data: T }` (+ `meta` on lists). */
export type ApiEnvelope<T> = {
  success: true;
  data: T;
};

/** Session payload — admin identity only; never carries credential material. */
export type AdminSummary = {
  id: string;
  name: string;
  email: string;
};

export type SessionData = {
  admin: AdminSummary;
};

export type LoginCredentials = {
  email: string;
  password: string;
};

/** The documented error half: `{ success: false, error: { code, message } }`. */
export type ApiErrorBody = {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Array<{ field: string; message: string }>;
  };
};
