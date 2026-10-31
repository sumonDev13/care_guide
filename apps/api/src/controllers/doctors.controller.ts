import type { Request, Response } from "express";
import { ApiError } from "../utils/errors.js";
import { sendSuccess } from "../utils/http-response.js";
import {
  createDoctor,
  deleteDoctor,
  getDoctor,
  listDoctors,
  listDoctorPatients,
  updateDoctor,
} from "../services/doctors.service.js";
import {
  createDoctorSchema,
  doctorIdParamSchema,
  listDoctorPatientsQuerySchema,
  listDoctorsQuerySchema,
  updateDoctorSchema,
} from "../validators/doctors.validators.js";

/**
 * Controllers stay thin: parse (zod → 422 via the central error handler on
 * failure), delegate to the service, respond with the single success
 * envelope. Business rules live below this file.
 */

function parseDoctorId(req: Request): string {
  const parsed = doctorIdParamSchema.safeParse(req.params.id);
  if (!parsed.success) {
    throw ApiError.badRequest(parsed.error.issues[0]?.message ?? "Malformed doctor identifier.");
  }
  return parsed.data;
}

export async function createDoctorHandler(req: Request, res: Response): Promise<void> {
  const dto = createDoctorSchema.parse(req.body);
  const doctor = await createDoctor(dto);
  sendSuccess(res, { doctor }, undefined, 201);
}

export async function getDoctorHandler(req: Request, res: Response): Promise<void> {
  const doctor = await getDoctor(parseDoctorId(req));
  sendSuccess(res, { doctor });
}

export async function updateDoctorHandler(req: Request, res: Response): Promise<void> {
  const id = parseDoctorId(req);
  const patch = updateDoctorSchema.parse(req.body);
  const doctor = await updateDoctor(id, patch);
  sendSuccess(res, { doctor });
}

export async function listDoctorsHandler(req: Request, res: Response): Promise<void> {
  const query = listDoctorsQuerySchema.parse(req.query);
  const { doctors, meta } = await listDoctors(query);
  sendSuccess(res, { doctors }, meta);
}

export async function listDoctorPatientsHandler(req: Request, res: Response): Promise<void> {
  const doctorId = parseDoctorId(req);
  const query = listDoctorPatientsQuerySchema.parse(req.query);
  const { patients, meta } = await listDoctorPatients(doctorId, query);
  sendSuccess(res, { patients }, meta);
}

export async function deleteDoctorHandler(req: Request, res: Response): Promise<void> {
  await deleteDoctor(parseDoctorId(req));
  sendSuccess(res, { deleted: true });
}
