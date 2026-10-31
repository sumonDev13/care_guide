import type { Request, Response } from "express";
import { sendSuccess } from "../utils/http-response.js";
import { getDashboardStats } from "../services/dashboard.service.js";

/**
 * Thin controller for the dashboard surface: delegate to the service,
 * respond with the single success envelope.
 */
export async function getDashboardStatsHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const stats = await getDashboardStats();
  sendSuccess(res, { stats });
}