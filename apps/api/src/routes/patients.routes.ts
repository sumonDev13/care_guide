import { Router } from "express";
import { requireAuth } from "../middleware/require-auth.js";
import {
  createPatientHandler,
  deletePatientHandler,
  getPatientHandler,
  listPatientsHandler,
  updatePatientHandler,
} from "../controllers/patients.controller.js";

/**
 * Patients surface (Step 7) — admin-console-only; the whole router sits
 * behind the session guard. DELETE is a hard delete (decision #5); the
 * frontend owns the confirmation dialog before calling it.
 */
export function makePatientsRouter(): Router {
  const patientsRouter = Router();

  patientsRouter.use(requireAuth);

  patientsRouter.post("/", createPatientHandler);
  patientsRouter.get("/", listPatientsHandler);
  patientsRouter.get("/:id", getPatientHandler);
  patientsRouter.patch("/:id", updatePatientHandler);
  patientsRouter.delete("/:id", deletePatientHandler);

  return patientsRouter;
}
