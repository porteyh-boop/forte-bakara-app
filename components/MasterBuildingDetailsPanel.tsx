"use client";

import { useEffect, useState } from "react";
import { DossierKpi } from "@/components/MasterBuildingDossierShared";
import MasterBuildingDetailsForm from "@/components/MasterBuildingDetailsForm";
import type { MasterBuildingFormState } from "@/lib/master-building-form";

export type MasterBuildingDetailsView = {
  buildingId: string;
  name: string;
  city: string | null;
  address: string | null;
  managementCompany: string | null;
  elevatorCompany: string | null;
  contactName: string | null;
  contactPhone: string | null;
  floorsCount: number | null;
};

interface MasterBuildingDetailsPanelProps {
  details: MasterBuildingDetailsView;
  canEdit: boolean;
  editing: boolean;
  form: MasterBuildingFormState;
  onStartEdit?: () => void;
  onCancelEdit?: () => void;
  onChange: (patch: Partial<MasterBuildingFormState>) => void;
  onSubmit?: (e: React.FormEvent) => void;
  saving?: boolean;
}

export default function MasterBuildingDetailsPanel({
  details,
  canEdit,
  editing,
  form,
  onStartEdit,
  onCancelEdit,
  onChange,
  onSubmit,
  saving = false,
}: MasterBuildingDetailsPanelProps) {
  const [editBlockedMessage, setEditBlockedMessage] = useState(false);

  useEffect(() => {
    if (editing) {
      setEditBlockedMessage(false);
    }
  }, [editing]);

  function handleEditClick() {
    if (canEdit && onStartEdit) {
      setEditBlockedMessage(false);
      onStartEdit();
      return;
    }
    setEditBlockedMessage(true);
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-navy">פרטי בניין</h3>
          <p className="text-[11px] text-gray-text mt-0.5">
            פרטים אלה שייכים לבניין ואינם מעדכנים משתמשי פורטל.
          </p>
        </div>
        {!editing && (
          <button
            type="button"
            onClick={handleEditClick}
            className="text-xs font-semibold bg-navy text-white px-3 py-1.5 rounded-lg"
          >
            ערוך פרטי בניין
          </button>
        )}
      </div>

      {editing && onSubmit ? (
        <form onSubmit={onSubmit} className="space-y-3">
          <MasterBuildingDetailsForm
            form={form}
            onChange={onChange}
            isEdit
            showBuildingId={false}
          />
          <div className="flex gap-2">
            <button type="submit" className="btn-primary flex-1" disabled={saving}>
              {saving ? "שומר..." : "שמור פרטי בניין"}
            </button>
            {onCancelEdit && (
              <button
                type="button"
                onClick={onCancelEdit}
                className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold"
              >
                ביטול
              </button>
            )}
          </div>
        </form>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-6 gap-2">
          <DossierKpi label="שם בניין" value={details.name} small />
          <DossierKpi label="עיר" value={details.city ?? "—"} small />
          <DossierKpi label="כתובת" value={details.address ?? "—"} small />
          <DossierKpi
            label="חברת ניהול של הבניין"
            value={details.managementCompany ?? "—"}
            small
          />
          <DossierKpi
            label="חברת מעליות"
            value={details.elevatorCompany ?? "—"}
            small
          />
          <DossierKpi
            label="איש קשר תפעולי של הבניין"
            value={details.contactName ?? "—"}
            small
          />
          <DossierKpi
            label="טלפון איש קשר תפעולי"
            value={details.contactPhone ?? "—"}
            small
          />
          <DossierKpi
            label="מספר קומות"
            value={details.floorsCount ?? "—"}
          />
        </div>
      )}

      {editBlockedMessage && !editing && (
        <p className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
          עריכה זמינה לבניינים בענן בלבד
        </p>
      )}
    </div>
  );
}
