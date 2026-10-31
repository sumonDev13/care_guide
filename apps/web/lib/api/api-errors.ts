import type { FetchBaseQueryError } from "@reduxjs/toolkit/query";
import type { ApiErrorBody } from "./types";

/**
 * Runtime guard for the shape RTK Query attaches to thrown requests
 * (the docs' hand-rolled variant — RTK 2.13 ships no runtime helper for it).
 */
function isFetchBaseQueryError(error: unknown): error is FetchBaseQueryError {
  return typeof error === "object" && error !== null && "status" in error;
}

/** Accepts only the exact error-half shape the API documents. */
function asErrorBody(data: unknown): ApiErrorBody | null {
  if (
    typeof data === "object" &&
    data !== null &&
    "success" in data &&
    (data as { success: unknown }).success === false &&
    "error" in data
  ) {
    const body = data as ApiErrorBody;
    if (typeof body.error.message === "string") return body;
  }
  return null;
}

/** True only for the documented "no live session" signal (HTTP 401). */
export function isUnauthorized(error: unknown): boolean {
  return isFetchBaseQueryError(error) && error.status === 401;
}

/**
 * One human-readable line from any shape the client can receive: the API's
 * error envelope, transport failure, or a plain status code.
 */
export function failureMessage(error: unknown): string {
  if (isFetchBaseQueryError(error)) {
    const body = asErrorBody(error.data);
    if (body) return body.error.message;
    if (error.status === "FETCH_ERROR") {
      return "Cannot reach the server. Check your connection and try again.";
    }
    if (typeof error.status === "number") {
      return `The request failed (HTTP ${error.status}).`;
    }
    return `The request failed (${error.status}).`;
  }
  if (error instanceof Error && error.message) return error.message;
  return "Something went wrong. Please try again.";
}
