import { Router } from "express";
import { requireAuth } from "../middleware/require-auth.js";
import {
  createDoctorHandler,
  deleteDoctorHandler,
  getDoctorHandler,
  listDoctorPatientsHandler,
  listDoctorsHandler,
  updateDoctorHandler,
} from "../controllers/doctors.controller.js";

/**
 * Doctors surface — admin-console-only, so the whole router sits behind the
 * session guard. The service-level deletion guard (decision #6: 409 while
 * any patient is assigned) pairs with the patient-side pre("save") hook to
 * close both directions of orphaning without transactions (decision #13).
 */
export function makeDoctorsRouter(): Router {
  const doctorsRouter = Router();

  doctorsRouter.use(requireAuth);

  doctorsRouter.post("/", createDoctorHandler);
  doctorsRouter.get("/", listDoctorsHandler);
  doctorsRouter.get("/:id", getDoctorHandler);
  doctorsRouter.get("/:id/patients", listDoctorPatientsHandler);
  doctorsRouter.patch("/:id", updateDoctorHandler);
  doctorsRouter.delete("/:id", deleteDoctorHandler);

  return doctorsRouter;
}
