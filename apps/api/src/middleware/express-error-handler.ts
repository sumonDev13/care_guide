import type { NextFunction, Request, Response } from "express";
import mongoose from "mongoose";
import { ZodError } from "zod";
import { ApiError } from "../utils/errors.js";

type ErrorBody = {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

function sendError(res: Response, status: number, body: ErrorBody, requestId?: string): void {
  if (requestId !== undefined) res.setHeader("x-request-id", requestId);
  res.status(status).json(body);
}

/**
 * Single exit point for every error the request pipeline can produce:
 *  - ZodError (validation)       → 422 VALIDATION_ERROR with field details
 *  - ApiError (business rules)   → its own status + code
 *  - malformed JSON bodies       → 400 INVALID_JSON_BODY
 *  - anything else               → 500 INTERNAL_SERVER_ERROR, generic message;
 *                                  the real cause (incl. stack) is logged
 *                                  server-side only, never serialized.
 */
export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const requestId = typeof req.id === "string" ? req.id : undefined;

  if (res.headersSent) {
    next(err);
    return;
  }

  if (err instanceof ZodError) {
    const details = err.issues.map((issue) => ({
      field: issue.path.join(".") || "(root)",
      message: issue.message,
    }));
    sendError(
      res,
      422,
      {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "The provided data is invalid.",
          details,
        },
      },
      requestId,
    );
    return;
  }

  if (err instanceof mongoose.Error.ValidationError) {
    // Mongoose model-level validation (e.g. the patient-side doctor reference
    // hook) reaching the pipeline instead of a service-mapped ApiError.
    const details = Object.values(err.errors).map((cause) => ({
      field: String(cause.path),
      message: cause.message,
    }));
    sendError(
      res,
      422,
      {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "The provided data is invalid.",
          details,
        },
      },
      requestId,
    );
    return;
  }

  if (err instanceof ApiError) {
    const body: ErrorBody = { success: false, error: { code: err.code, message: err.message } };
    if (err.details !== undefined) body.error.details = err.details;
    sendError(res, err.status, body, requestId);
    return;
  }

  if (
    typeof err === "object" &&
    err !== null &&
    err instanceof SyntaxError &&
    "body" in err
  ) {
    sendError(
      res,
      400,
      {
        success: false,
        error: {
          code: "INVALID_JSON_BODY",
          message: "The request body is not valid JSON.",
        },
      },
      requestId,
    );
    return;
  }

  req.log?.error({ err }, "Unhandled error in request pipeline");
  sendError(
    res,
    500,
    {
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "An unexpected error occurred. Please try again.",
      },
    },
    requestId,
  );
}
