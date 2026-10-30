import type { Response } from "express";

/**
 * The single success envelope for this API:
 *   { "success": true, "data": <payload>, "meta?": <pagination/summary> }
 */
export function sendSuccess(
  res: Response,
  data: unknown,
  meta?: unknown,
  status = 200,
): void {
  const body =
    meta === undefined
      ? { success: true, data }
      : { success: true, data, meta };
  res.status(status).json(body);
}
