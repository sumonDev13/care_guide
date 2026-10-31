"use client";

import { useState } from "react";
import { useDeleteDoctorMutation } from "@/lib/api/api";
import { failureMessage } from "@/lib/api/api-errors";

/**
 * Deletion confirmation (decision #5's doctor sibling — decision #6):
 * nothing destructhing happens without an explicit confirm, and the API's
 * 409 "patients still assigned" guidance is shown in-dialog where the user
 * can act on it.
 */
export function ConfirmDoctorDelete({
  doctor,
  onClose,
}: {
  doctor: { id: string; name: string };
  onClose: (deleted: boolean) => void;
}) {
  const [deleteDoctor, { isLoading }] = useDeleteDoctorMutation();
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    setError(null);
    try {
      await deleteDoctor(doctor.id).unwrap();
      onClose(true);
    } catch (failure) {
      // 409 while patients remain assigned — show the API's guidance verbatim.
      setError(failureMessage(failure));
    }
  }

  return (
    <div className="dialogOverlay" role="presentation">
      <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="delete-doctor-title">
        <h2 id="delete-doctor-title">Delete doctor</h2>
        <p className="dialogBody">
          Permanently delete <strong>{doctor.name}</strong>? Doctors with assigned
          patients can&apos;t be deleted until the patients are removed or reassigned.
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
            {isLoading ? "Deleting…" : "Delete doctor"}
          </button>
        </div>
      </div>
    </div>
  );
}
