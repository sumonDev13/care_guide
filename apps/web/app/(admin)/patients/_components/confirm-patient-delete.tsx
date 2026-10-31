"use client";

import { useState } from "react";
import { useDeletePatientMutation } from "@/lib/api/api";
import { failureMessage } from "@/lib/api/api-errors";

/**
 * Deletion confirmation (decision #5): patient deletion is a HARD delete —
 * no soft-delete copy exists anywhere — so the dialog says so explicitly and
 * nothing happens without the confirm.
 */
export function ConfirmPatientDelete({
  patient,
  onClose,
}: {
  patient: { id: string; name: string; doctorId: string };
  onClose: (deleted: boolean) => void;
}) {
  const [deletePatient, { isLoading }] = useDeletePatientMutation();
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    setError(null);
    try {
      await deletePatient({ id: patient.id, doctorId: patient.doctorId }).unwrap();
      onClose(true);
    } catch (failure) {
      setError(failureMessage(failure));
    }
  }

  return (
    <div className="dialogOverlay" role="presentation">
      <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="delete-patient-title">
        <h2 id="delete-patient-title">Delete patient</h2>
        <p className="dialogBody">
          Permanently delete <strong>{patient.name}</strong>? This is a hard
          delete — the record cannot be recovered afterwards.
        </p>
        {error && (
          <p className="alert" role="alert">
            {error}
          </p>
        )}
        <div className="dialogActions">
          <button className="btnGhost" type="button" onClick={() => onClose(false)} disabled={isLoading}>
            Cancel
          </button>
          <button className="dangerButton" type="button" onClick={() => void confirm()} disabled={isLoading}>
            {isLoading ? "Deleting…" : "Delete patient"}
          </button>
        </div>
      </div>
    </div>
  );
}
