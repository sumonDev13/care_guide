import type { Request, Response } from "express";

/**
 * Exhaustive 404 for the mounted API surface — everything that reached here
 * matched no route. Rendered with the standard error envelope, not as a
 * thrown error, because there is nothing to "crash" about.
 */
export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    error: {
      code: "ROUTE_NOT_FOUND",
      message: `Route ${req.method} ${req.path} does not exist.`,
    },
  });
}
