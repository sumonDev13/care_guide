/**
 * Typed application errors carrying an API-facing shape. Only these safe,
 * deliberate values are serialized to clients — internals stay in server logs.
 */
export type ErrorCode =
  | "INTERNAL_SERVER_ERROR"
  | "ROUTE_NOT_FOUND"
  | "INVALID_JSON_BODY"
  | "VALIDATION_ERROR"
  | "BAD_REQUEST"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMITED";

export class ApiError extends Error {
  readonly status: number;
  readonly code: ErrorCode;
  readonly details?: unknown;

  constructor(status: number, code: ErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }

  static badRequest(message = "The request cannot be processed.", details?: unknown): ApiError {
    return new ApiError(400, "BAD_REQUEST", message, details);
  }

  static unauthorized(message = "Authentication is required."): ApiError {
    return new ApiError(401, "UNAUTHORIZED", message);
  }

  static forbidden(message = "You do not have permission to perform this action."): ApiError {
    return new ApiError(403, "FORBIDDEN", message);
  }

  static notFound(message = "The requested resource was not found."): ApiError {
    return new ApiError(404, "NOT_FOUND", message);
  }

  static conflict(message: string): ApiError {
    return new ApiError(409, "CONFLICT", message);
  }

  static validation(message: string, details: unknown): ApiError {
    return new ApiError(422, "VALIDATION_ERROR", message, details);
  }
}
