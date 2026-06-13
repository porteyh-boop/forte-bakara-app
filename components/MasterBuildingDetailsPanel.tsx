"use client";

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
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-navy">פרטי בניין</h3>
        {canEdit && !editing && onStartEdit && (
          <button
            type="button"
            onClick={onStartEdit}
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
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          <DossierKpi label="שם בניין" value={details.name} small />
          <DossierKpi label="עיר" value={details.city ?? "—"} small />
          <DossierKpi label="כתובת" value={details.address ?? "—"} small />
          <DossierKpi
            label="חברת ניהול"
            value={details.managementCompany ?? "—"}
            small
          />
          <DossierKpi
            label="חברת מעליות"
            value={details.elevatorCompany ?? "—"}
            small
          />
          <DossierKpi label="איש קשר" value={details.contactName ?? "—"} small />
          <DossierKpi label="טלפון" value={details.contactPhone ?? "—"} small />
          <DossierKpi
            label="מספר קומות"
            value={details.floorsCount ?? "—"}
          />
        </div>
      )}

      {!canEdit && (
        <p className="text-xs text-gray-text">
          עריכת פרטי בניין זמינה לבניינים הרשומים בענן בלבד.
        </p>
      )}
    </div>
  );
}
