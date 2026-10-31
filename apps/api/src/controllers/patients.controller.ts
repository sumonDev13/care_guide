import type { Request, Response } from "express";
import { ApiError } from "../utils/errors.js";
import { sendSuccess } from "../utils/http-response.js";
import {
  createPatient,
  deletePatient,
  getPatient,
  listPatients,
  updatePatient,
} from "../services/patients.service.js";
import {
  createPatientSchema,
  listPatientsQuerySchema,
  patientIdParamSchema,
  updatePatientSchema,
} from "../validators/patients.validators.js";

/**
 * Controllers stay thin: parse (zod → 422 by the central error handler),
 * delegate to the service, respond with the single success envelope.
 */

function parsePatientId(req: Request): string {
  const parsed = patientIdParamSchema.safeParse(req.params.id);
  if (!parsed.success) {
    throw ApiError.badRequest(parsed.error.issues[0]?.message ?? "Malformed patient identifier.");
  }
  return parsed.data;
}

export async function createPatientHandler(req: Request, res: Response): Promise<void> {
  const dto = createPatientSchema.parse(req.body);
  const patient = await createPatient(dto);
  sendSuccess(res, { patient }, undefined, 201);
}

export async function getPatientHandler(req: Request, res: Response): Promise<void> {
  const patient = await getPatient(parsePatientId(req));
  sendSuccess(res, { patient });
}

export async function updatePatientHandler(req: Request, res: Response): Promise<void> {
  const id = parsePatientId(req);
  const patch = updatePatientSchema.parse(req.body);
  const patient = await updatePatient(id, patch);
  sendSuccess(res, { patient });
}

export async function listPatientsHandler(req: Request, res: Response): Promise<void> {
  const query = listPatientsQuerySchema.parse(req.query);
  const { patients, meta } = await listPatients(query);
  sendSuccess(res, { patients }, meta);
}

export async function deletePatientHandler(req: Request, res: Response): Promise<void> {
  await deletePatient(parsePatientId(req));
  sendSuccess(res, { deleted: true });
}
