import { Router } from "express";
import { requireAuth } from "../middleware/require-auth.js";
import {
  createDoctorHandler,
  getDoctorHandler,
  listDoctorPatientsHandler,
  listDoctorsHandler,
  updateDoctorHandler,
} from "../controllers/doctors.controller.js";

/**
 * Doctors surface (Step 6) — admin-console-only, so the whole router sits
 * behind the session guard. Deletion is intentionally NOT here yet: it lands
 * with the patients API (Step 7) so both deletion rules — patient hard
 * delete and the doctor 409-while-patients-assigned guard — ship together.
 */
export function makeDoctorsRouter(): Router {
  const doctorsRouter = Router();

  doctorsRouter.use(requireAuth);

  doctorsRouter.post("/", createDoctorHandler);
  doctorsRouter.get("/", listDoctorsHandler);
  doctorsRouter.get("/:id", getDoctorHandler);
  doctorsRouter.get("/:id/patients", listDoctorPatientsHandler);
  doctorsRouter.patch("/:id", updateDoctorHandler);

  return doctorsRouter;
}
