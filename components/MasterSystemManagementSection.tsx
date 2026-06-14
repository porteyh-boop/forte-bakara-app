"use client";

interface BuildingOption {
  id: string;
  label: string;
}

interface MasterSystemManagementSectionProps {
  cloudReady: boolean;
  loading: boolean;
  resetBuildingId: string;
  onResetBuildingIdChange: (buildingId: string) => void;
  buildingOptions: BuildingOption[];
  onResetAll: () => void | Promise<void>;
  onResetByBuilding: () => void | Promise<void>;
}

export default function MasterSystemManagementSection({
  cloudReady,
  loading,
  resetBuildingId,
  onResetBuildingIdChange,
  buildingOptions,
  onResetAll,
  onResetByBuilding,
}: MasterSystemManagementSectionProps) {
  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3">
        <h2 className="text-base font-bold text-navy">ניהול מערכת</h2>
        <p className="text-sm text-gray-text">
          איפוס נתוני פיילוט בענן — דיווחים ומשובים (Supabase בלבד). לא משפיע על
          בניינים, מעליות או מסמכים רשומים.
        </p>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void onResetAll()}
            disabled={!cloudReady || loading}
            className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"
          >
            איפוס כל הבניינים
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-gray-100 md:flex-nowrap">
          <p className="text-xs font-semibold text-gray-text w-full md:w-auto md:shrink-0">
            איפוס לפי בניין (Supabase בלבד)
          </p>
          <select
            value={resetBuildingId}
            onChange={(e) => onResetBuildingIdChange(e.target.value)}
            className="form-input flex-1 min-w-[12rem] md:min-w-0"
            disabled={!cloudReady || loading}
          >
            {buildingOptions.map((b) => (
              <option key={b.id} value={b.id}>
                {b.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => void onResetByBuilding()}
            disabled={!cloudReady || loading || !resetBuildingId}
            className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"
          >
            איפוס לבניין הנבחר
          </button>
        </div>
      </div>
    </div>
  );
}
