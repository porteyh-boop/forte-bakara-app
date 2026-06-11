"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BUILDINGS_CATALOG_UPDATED_EVENT,
} from "@/lib/buildings-catalog";
import {
  canDeleteBuilding,
  canDeleteElevator,
  createCloudBuilding,
  createCloudElevator,
  deleteCloudBuilding,
  deleteCloudElevator,
  ELEVATOR_STATUS_OPTIONS,
  getAllCloudBuildingsWithMeta,
  getAllCloudElevators,
  INITIALIZE_BUILDING_FOR_LIVE_CONFIRM,
  initializeBuildingForLiveUse,
  normalizeBuildingId,
  setCloudBuildingActive,
  setCloudElevatorActive,
  updateCloudBuilding,
  updateCloudElevator,
  type CloudBuildingRow,
  type CloudElevatorRow,
  type ElevatorStatusOption,
} from "@/lib/buildings-cloud";
import { setCachedLiveStartedAt } from "@/lib/building-live";
import { BUILDING_LIVE_STARTED_EVENT } from "@/hooks/useBuildingLiveStarted";
import {
  getAllDemoBuildingIds,
  getDemoDatasets,
  getStaticDemoBuildingMeta,
  refreshBuildingCatalog,
} from "@/lib/buildings";
import {
  buildMasterBuildingList,
  formatMasterBuildingSources,
  summarizeFaultBuildings,
} from "@/lib/master-buildings-list";
import {
  DEFAULT_ELEVATOR_COMPANIES,
  isOtherElevatorCompany,
} from "@/lib/elevator-companies";
import type { PilotCloudFault } from "@/lib/pilot-cloud";
import {
  buildBuildingDossier,
  formatDossierDate,
  getHealthLevelClasses,
} from "@/lib/master-building-dossier";
import { buildMasterElevatorDossierPath } from "@/lib/master-elevator-routes";
import MasterProfessionalAssessmentPanel from "@/components/MasterProfessionalAssessmentPanel";

interface MasterBuildingsSectionProps {
  cloudReady: boolean;
  faults: PilotCloudFault[];
  onDataChanged?: () => void | Promise<void>;
}

type BuildingFormState = {
  buildingId: string;
  name: string;
  city: string;
  address: string;
  managementCompany: string;
  elevatorCompany: string;
  customElevatorCompany: string;
  contactName: string;
  contactPhone: string;
  floorsCount: string;
};

type ElevatorFormState = {
  elevatorId: string;
  elevatorName: string;
  floorsCount: string;
  elevatorType: string;
  status: ElevatorStatusOption;
};

const emptyBuildingForm = (): BuildingFormState => ({
  buildingId: "",
  name: "",
  city: "",
  address: "",
  managementCompany: "",
  elevatorCompany: DEFAULT_ELEVATOR_COMPANIES[0],
  customElevatorCompany: "",
  contactName: "",
  contactPhone: "",
  floorsCount: "",
});

const emptyElevatorForm = (): ElevatorFormState => ({
  elevatorId: "",
  elevatorName: "",
  floorsCount: "",
  elevatorType: "",
  status: "פעילה",
});

function resolveElevatorCompany(form: BuildingFormState): string {
  if (isOtherElevatorCompany(form.elevatorCompany)) {
    return form.customElevatorCompany.trim();
  }
  return form.elevatorCompany.trim();
}

function buildingFormFromRow(row: CloudBuildingRow): BuildingFormState {
  const known = DEFAULT_ELEVATOR_COMPANIES.includes(
    row.elevator_company as (typeof DEFAULT_ELEVATOR_COMPANIES)[number]
  );
  return {
    buildingId: row.building_id,
    name: row.name,
    city: row.city ?? "",
    address: row.address ?? "",
    managementCompany: row.management_company ?? "",
    elevatorCompany: known
      ? (row.elevator_company as string)
      : row.elevator_company
        ? "אחר"
        : DEFAULT_ELEVATOR_COMPANIES[0],
    customElevatorCompany: known ? "" : (row.elevator_company ?? ""),
    contactName: row.contact_name ?? "",
    contactPhone: row.contact_phone ?? "",
    floorsCount: row.floors_count != null ? String(row.floors_count) : "",
  };
}

function elevatorFormFromRow(row: CloudElevatorRow): ElevatorFormState {
  const status = ELEVATOR_STATUS_OPTIONS.includes(
    row.status as ElevatorStatusOption
  )
    ? (row.status as ElevatorStatusOption)
    : "פעילה";
  return {
    elevatorId: row.elevator_id,
    elevatorName: row.elevator_name,
    floorsCount: row.floors_count != null ? String(row.floors_count) : "",
    elevatorType: row.elevator_type ?? "",
    status,
  };
}

export default function MasterBuildingsSection({
  cloudReady,
  faults,
  onDataChanged,
}: MasterBuildingsSectionProps) {
  const [buildings, setBuildings] = useState<CloudBuildingRow[]>([]);
  const [elevatorsByBuilding, setElevatorsByBuilding] = useState<
    Record<string, CloudElevatorRow[]>
  >({});
  const [selectedBuildingId, setSelectedBuildingId] = useState<string | null>(
    null
  );
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [showBuildingForm, setShowBuildingForm] = useState(false);
  const [editingBuilding, setEditingBuilding] = useState<CloudBuildingRow | null>(
    null
  );
  const [buildingForm, setBuildingForm] = useState<BuildingFormState>(
    emptyBuildingForm
  );

  const [showElevatorForm, setShowElevatorForm] = useState(false);
  const [editingElevator, setEditingElevator] = useState<CloudElevatorRow | null>(
    null
  );
  const [elevatorForm, setElevatorForm] = useState<ElevatorFormState>(
    emptyElevatorForm
  );

  const [cloudLoadError, setCloudLoadError] = useState<string | null>(null);
  const [listVersion, setListVersion] = useState(0);

  const faultBuildingSummaries = useMemo(
    () => summarizeFaultBuildings(faults),
    [faults]
  );

  const masterBuildingList = useMemo(
    () =>
      buildMasterBuildingList({
        cloudBuildings: buildings,
        demoBuildingIds: getAllDemoBuildingIds(),
        resolveDemoName: (id) => getStaticDemoBuildingMeta(id).name,
        resolveDemoCity: (id) => getStaticDemoBuildingMeta(id).city,
        faultBuildings: faultBuildingSummaries,
      }),
    [buildings, faultBuildingSummaries, listVersion]
  );

  useEffect(() => {
    function onCatalogUpdated() {
      setListVersion((v) => v + 1);
    }
    window.addEventListener(BUILDINGS_CATALOG_UPDATED_EVENT, onCatalogUpdated);
    return () => {
      window.removeEventListener(
        BUILDINGS_CATALOG_UPDATED_EVENT,
        onCatalogUpdated
      );
    };
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    setCloudLoadError(null);

    let rows: CloudBuildingRow[] = [];
    let grouped: Record<string, CloudElevatorRow[]> = {};

    if (cloudReady) {
      const [cloudResult, allElevators] = await Promise.all([
        getAllCloudBuildingsWithMeta(),
        getAllCloudElevators(),
      ]);
      rows = cloudResult.rows;
      if (cloudResult.error) {
        setCloudLoadError(cloudResult.error);
      }
      for (const e of allElevators) {
        if (!grouped[e.building_id]) grouped[e.building_id] = [];
        grouped[e.building_id].push(e);
      }
    }

    setBuildings(rows);
    setElevatorsByBuilding(grouped);
    setLoading(false);
  }, [cloudReady]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (selectedBuildingId) return;
    if (masterBuildingList[0]) {
      setSelectedBuildingId(masterBuildingList[0].buildingId);
    }
  }, [masterBuildingList, selectedBuildingId]);

  const selectedEntry = masterBuildingList.find(
    (b) => b.buildingId === selectedBuildingId
  );
  const selectedBuilding = selectedEntry?.cloudRow ?? null;
  const selectedElevators = selectedBuildingId
    ? (elevatorsByBuilding[selectedBuildingId] ?? [])
    : [];

  const selectedBuildingName =
    selectedEntry?.name ??
    faults.find((f) => f.building_id === selectedBuildingId)?.building_name ??
    selectedBuildingId ??
    "";

  const selectedDossier = useMemo(() => {
    if (!selectedBuildingId) return null;
    return buildBuildingDossier({
      buildingId: selectedBuildingId,
      buildingName: selectedBuildingName,
      faults,
      registeredElevatorIds: selectedElevators.map((e) => e.elevator_id),
    });
  }, [
    selectedBuildingId,
    selectedBuildingName,
    faults,
    selectedElevators,
  ]);

  const dossierByBuildingId = useMemo(() => {
    const map = new Map<
      string,
      ReturnType<typeof buildBuildingDossier>
    >();
    for (const entry of masterBuildingList) {
      map.set(
        entry.buildingId,
        buildBuildingDossier({
          buildingId: entry.buildingId,
          buildingName: entry.name,
          faults,
          registeredElevatorIds: (
            elevatorsByBuilding[entry.buildingId] ?? []
          ).map((e) => e.elevator_id),
        })
      );
    }
    return map;
  }, [masterBuildingList, elevatorsByBuilding, faults]);

  function selectBuilding(buildingId: string) {
    setSelectedBuildingId(buildingId);
    setShowBuildingForm(false);
    setShowElevatorForm(false);
  }

  function faultCountForElevator(elevatorId: string): number {
    return (
      selectedDossier?.faultsByElevator.find((e) => e.elevatorId === elevatorId)
        ?.count ?? 0
    );
  }

  function openAddBuilding() {
    setEditingBuilding(null);
    setBuildingForm(emptyBuildingForm());
    setShowBuildingForm(true);
    setError(null);
  }

  function openEditBuilding(row: CloudBuildingRow) {
    setEditingBuilding(row);
    setBuildingForm(buildingFormFromRow(row));
    setShowBuildingForm(true);
    setError(null);
  }

  function openAddElevator() {
    if (!selectedBuildingId) return;
    setEditingElevator(null);
    setElevatorForm(emptyElevatorForm());
    setShowElevatorForm(true);
    setError(null);
  }

  function openEditElevator(row: CloudElevatorRow) {
    setEditingElevator(row);
    setElevatorForm(elevatorFormFromRow(row));
    setShowElevatorForm(true);
    setError(null);
  }

  async function afterMutation(successMessage: string) {
    await refreshBuildingCatalog(getDemoDatasets());
    setListVersion((v) => v + 1);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(BUILDINGS_CATALOG_UPDATED_EVENT));
    }
    await refresh();
    setMessage(successMessage);
    setTimeout(() => setMessage(null), 3000);
  }

  async function handleSaveBuilding(e: React.FormEvent) {
    e.preventDefault();
    if (!cloudReady) return;
    setError(null);

    const floorsCount = buildingForm.floorsCount
      ? Number(buildingForm.floorsCount)
      : null;
    const payload = {
      buildingId: normalizeBuildingId(buildingForm.buildingId),
      name: buildingForm.name,
      city: buildingForm.city,
      address: buildingForm.address,
      managementCompany: buildingForm.managementCompany,
      elevatorCompany: resolveElevatorCompany(buildingForm),
      contactName: buildingForm.contactName,
      contactPhone: buildingForm.contactPhone,
      floorsCount: Number.isFinite(floorsCount) ? floorsCount : null,
    };

    if (!payload.name.trim()) {
      setError("שם בניין הוא שדה חובה.");
      return;
    }

    if (editingBuilding) {
      const updated = await updateCloudBuilding(editingBuilding.id, payload);
      if (!updated) {
        setError("עדכון בניין נכשל.");
        return;
      }
      setShowBuildingForm(false);
      await afterMutation("הבניין עודכן בהצלחה.");
      return;
    }

    if (!payload.buildingId) {
      setError("מזהה בניין הוא שדה חובה.");
      return;
    }

    const created = await createCloudBuilding(payload);
    if (!created) {
      setError("הוספת בניין נכשלה. ודאו שמזהה הבניין ייחודי.");
      return;
    }
    setShowBuildingForm(false);
    setSelectedBuildingId(created.building_id);
    await afterMutation("הבניין נוסף בהצלחה.");
  }

  async function handleToggleBuilding(row: CloudBuildingRow) {
    const ok = await setCloudBuildingActive(row.id, !row.is_active);
    if (!ok) {
      setError("עדכון סטטוס בניין נכשל.");
      return;
    }
    await afterMutation(row.is_active ? "הבניין הושבת." : "הבניין הופעל.");
  }

  async function handleDeleteBuilding(row: CloudBuildingRow) {
    const guard = canDeleteBuilding(row.building_id, faults);
    if (!guard.allowed) {
      setError(guard.reason ?? "לא ניתן למחוק בניין זה.");
      return;
    }
    if (!confirm(`למחוק את הבניין "${row.name}"?`)) return;

    const result = await deleteCloudBuilding(row.id, row.building_id, faults);
    if (!result.deleted) {
      setError(result.reason ?? "מחיקת בניין נכשלה.");
      return;
    }
    if (selectedBuildingId === row.building_id) setSelectedBuildingId(null);
    await afterMutation("הבניין נמחק.");
  }

  async function handleInitializeForLiveUse(
    buildingId: string,
    buildingName: string
  ) {
    if (!cloudReady) {
      setError("Supabase לא מחובר.");
      return;
    }

    const faultCount = faults.filter((f) => f.building_id === buildingId).length;
    if (
      !window.confirm(
        `${INITIALIZE_BUILDING_FOR_LIVE_CONFIRM}\n\n` +
          `בניין: ${buildingName} (${buildingId})\n\n` +
          `יפעלו:\n` +
          `• מחיקת ${faultCount} דיווחים מ-Supabase\n` +
          `• מחיקת כל המשובים של הבניין\n` +
          `• סימון live_started_at — דמו ו-localStorage ישנים לא יוצגו בלקוח\n\n` +
          `בניינים אחרים לא יושפעו.\n\n` +
          `האם להמשיך?`
      )
    ) {
      return;
    }

    setLoading(true);
    setError(null);
    const result = await initializeBuildingForLiveUse({
      buildingId,
      buildingName,
    });
    setLoading(false);

    if (!result.ok || !result.liveStartedAt) {
      setError(result.reason ?? "אתחול בניין לשימוש אמיתי נכשל.");
      return;
    }

    setCachedLiveStartedAt(buildingId, result.liveStartedAt);
    await refreshBuildingCatalog(getDemoDatasets());
    setListVersion((v) => v + 1);
    await onDataChanged?.();
    window.dispatchEvent(
      new CustomEvent(BUILDING_LIVE_STARTED_EVENT, {
        detail: { buildingId, liveStartedAt: result.liveStartedAt },
      })
    );
    await refresh();
    setMessage(
      `הבניין "${buildingName}" אותחל לשימוש אמיתי. דיווחים חדשים בלבד יוצגו בלקוח.`
    );
    setTimeout(() => setMessage(null), 4000);
  }

  async function handleSaveElevator(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedBuildingId) return;
    setError(null);

    const floorsCount = elevatorForm.floorsCount
      ? Number(elevatorForm.floorsCount)
      : null;
    const payload = {
      buildingId: selectedBuildingId,
      elevatorId: elevatorForm.elevatorId.trim(),
      elevatorName: elevatorForm.elevatorName.trim(),
      floorsCount: Number.isFinite(floorsCount) ? floorsCount : null,
      elevatorType: elevatorForm.elevatorType,
      status: elevatorForm.status,
    };

    if (!payload.elevatorName) {
      setError("שם מעלית הוא שדה חובה.");
      return;
    }

    if (editingElevator) {
      const updated = await updateCloudElevator(editingElevator.id, payload);
      if (!updated) {
        setError("עדכון מעלית נכשל.");
        return;
      }
      setShowElevatorForm(false);
      await afterMutation("המעלית עודכנה בהצלחה.");
      return;
    }

    if (!payload.elevatorId) {
      setError("מזהה מעלית הוא שדה חובה.");
      return;
    }

    const created = await createCloudElevator(payload);
    if (!created) {
      setError("הוספת מעלית נכשלה. ודאו שמזהה המעלית ייחודי בבניין.");
      return;
    }
    setShowElevatorForm(false);
    await afterMutation("המעלית נוספה בהצלחה.");
  }

  async function handleToggleElevator(row: CloudElevatorRow) {
    const ok = await setCloudElevatorActive(row.id, !row.is_active);
    if (!ok) {
      setError("עדכון סטטוס מעלית נכשל.");
      return;
    }
    await afterMutation(row.is_active ? "המעלית הושבתה." : "המעלית הופעלה.");
  }

  async function handleDeleteElevator(row: CloudElevatorRow) {
    const guard = canDeleteElevator(
      row.building_id,
      row.elevator_id,
      faults
    );
    if (!guard.allowed) {
      setError(guard.reason ?? "לא ניתן למחוק מעלית זו.");
      return;
    }
    if (!confirm(`למחוק את המעלית "${row.elevator_name}"?`)) return;

    const result = await deleteCloudElevator(
      row.id,
      row.building_id,
      row.elevator_id,
      faults
    );
    if (!result.deleted) {
      setError(result.reason ?? "מחיקת מעלית נכשלה.");
      return;
    }
    await afterMutation("המעלית נמחקה.");
  }

  if (!cloudReady) {
    return (
      <section className="bg-white rounded-2xl border border-gray-200 p-4">
        <h2 className="text-base font-bold text-navy mb-2">ניהול בניינים</h2>
        <p className="text-sm text-gray-text">
          ניהול בניינים ומעליות זמין לאחר חיבור Supabase.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="bg-white rounded-2xl border border-gray-200 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div>
            <h2 className="text-base font-bold text-navy">ניהול בניינים — תיק בניין</h2>
            <p className="text-xs text-gray-text mt-0.5">
              ניהול בניינים, מעליות ותקלות מ-pilot_faults
            </p>
          </div>
          <button
            type="button"
            onClick={openAddBuilding}
            className="text-sm font-semibold bg-navy text-white px-4 py-2 rounded-xl"
          >
            הוסף בניין
          </button>
        </div>

        {message && (
          <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2 mb-3">
            {message}
          </p>
        )}
        {error && (
          <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2 mb-3">
            {error}
          </p>
        )}

        {cloudLoadError && (
          <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 mb-3">
            לא ניתן לטעון בניינים מ-Supabase ({cloudLoadError}). מוצגים בנייני
            דמו ומדיווחים.
          </p>
        )}

        {loading && masterBuildingList.length === 0 ? (
          <p className="text-sm text-gray-text">טוען בניינים...</p>
        ) : masterBuildingList.length === 0 ? (
          <p className="text-sm text-gray-text">אין בניינים מוכרים במערכת.</p>
        ) : (
          <ul className="space-y-2">
            {masterBuildingList.map((entry) => {
              const dossier = dossierByBuildingId.get(entry.buildingId);
              const cloudRow = entry.cloudRow;
              return (
              <li
                key={entry.buildingId}
                className={`border rounded-xl px-3 py-2 ${
                  selectedBuildingId === entry.buildingId
                    ? "border-navy bg-gray-light"
                    : "border-gray-200"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => selectBuilding(entry.buildingId)}
                    className="text-right flex-1"
                  >
                    <p className="font-semibold text-navy text-sm">{entry.name}</p>
                    <p className="text-xs text-gray-text">
                      {entry.buildingId}
                      {entry.city ? ` · ${entry.city}` : ""}
                      {cloudRow && !cloudRow.is_active ? " · מושבת" : ""}
                    </p>
                    <p className="text-[11px] text-gold mt-1">
                      מקור: {formatMasterBuildingSources(entry.sources)}
                    </p>
                    {dossier && (
                      <p className="text-[11px] text-gray-text mt-1">
                        {dossier.totalFaults} תקלות · {dossier.openFaults} פתוחות · בריאות {dossier.healthScore}
                      </p>
                    )}
                    {entry.liveStartedAt && (
                      <p className="text-[11px] text-emerald-700 mt-1">
                        שימוש אמיתי מ-{formatDossierDate(entry.liveStartedAt)}
                      </p>
                    )}
                  </button>
                  <div className="flex flex-wrap gap-1">
                    <ActionBtn
                      label="אתחל לשימוש אמיתי"
                      onClick={() =>
                        void handleInitializeForLiveUse(
                          entry.buildingId,
                          entry.name
                        )
                      }
                    />
                    {cloudRow && (
                      <>
                        <ActionBtn
                          label="ערוך"
                          onClick={() => openEditBuilding(cloudRow)}
                        />
                        <ActionBtn
                          label={cloudRow.is_active ? "השבת" : "הפעל"}
                          onClick={() => void handleToggleBuilding(cloudRow)}
                        />
                        <ActionBtn
                          label="מחק"
                          danger
                          onClick={() => void handleDeleteBuilding(cloudRow)}
                        />
                      </>
                    )}
                  </div>
                </div>
              </li>
            );
            })}
          </ul>
        )}
      </div>

      {showBuildingForm && (
        <form
          onSubmit={(e) => void handleSaveBuilding(e)}
          className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3"
        >
          <h3 className="text-sm font-bold text-navy">
            {editingBuilding ? "עריכת בניין" : "הוספת בניין"}
          </h3>
          <FormField label="מזהה בניין (building_id)">
            <input
              className="form-input"
              value={buildingForm.buildingId}
              onChange={(e) =>
                setBuildingForm((f) => ({ ...f, buildingId: e.target.value }))
              }
              disabled={Boolean(editingBuilding)}
              dir="ltr"
              required={!editingBuilding}
            />
          </FormField>
          <FormField label="שם בניין">
            <input
              className="form-input"
              value={buildingForm.name}
              onChange={(e) =>
                setBuildingForm((f) => ({ ...f, name: e.target.value }))
              }
              required
            />
          </FormField>
          <div className="grid grid-cols-2 gap-2">
            <FormField label="עיר">
              <input
                className="form-input"
                value={buildingForm.city}
                onChange={(e) =>
                  setBuildingForm((f) => ({ ...f, city: e.target.value }))
                }
              />
            </FormField>
            <FormField label="כתובת">
              <input
                className="form-input"
                value={buildingForm.address}
                onChange={(e) =>
                  setBuildingForm((f) => ({ ...f, address: e.target.value }))
                }
              />
            </FormField>
          </div>
          <FormField label="חברת ניהול">
            <input
              className="form-input"
              value={buildingForm.managementCompany}
              onChange={(e) =>
                setBuildingForm((f) => ({
                  ...f,
                  managementCompany: e.target.value,
                }))
              }
            />
          </FormField>
          <FormField label="חברת מעליות">
            <select
              className="form-input"
              value={buildingForm.elevatorCompany}
              onChange={(e) =>
                setBuildingForm((f) => ({
                  ...f,
                  elevatorCompany: e.target.value,
                }))
              }
            >
              {DEFAULT_ELEVATOR_COMPANIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </FormField>
          {isOtherElevatorCompany(buildingForm.elevatorCompany) && (
            <FormField label="שם חברת מעליות">
              <input
                className="form-input"
                value={buildingForm.customElevatorCompany}
                onChange={(e) =>
                  setBuildingForm((f) => ({
                    ...f,
                    customElevatorCompany: e.target.value,
                  }))
                }
              />
            </FormField>
          )}
          <div className="grid grid-cols-2 gap-2">
            <FormField label="איש קשר">
              <input
                className="form-input"
                value={buildingForm.contactName}
                onChange={(e) =>
                  setBuildingForm((f) => ({ ...f, contactName: e.target.value }))
                }
              />
            </FormField>
            <FormField label="טלפון">
              <input
                className="form-input"
                value={buildingForm.contactPhone}
                onChange={(e) =>
                  setBuildingForm((f) => ({
                    ...f,
                    contactPhone: e.target.value,
                  }))
                }
                dir="ltr"
              />
            </FormField>
          </div>
          <FormField label="מספר קומות">
            <input
              type="number"
              className="form-input"
              value={buildingForm.floorsCount}
              onChange={(e) =>
                setBuildingForm((f) => ({ ...f, floorsCount: e.target.value }))
              }
              min={0}
            />
          </FormField>
          <div className="flex gap-2">
            <button type="submit" className="btn-primary flex-1">
              שמור
            </button>
            <button
              type="button"
              onClick={() => setShowBuildingForm(false)}
              className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold"
            >
              ביטול
            </button>
          </div>
        </form>
      )}

      {selectedBuildingId && selectedDossier && (
        <>
          <div className="bg-white rounded-2xl border border-amber-200 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-navy">אתחול לשימוש אמיתי</p>
                <p className="text-xs text-gray-text mt-1">
                  {INITIALIZE_BUILDING_FOR_LIVE_CONFIRM}
                </p>
                {selectedEntry?.liveStartedAt && (
                  <p className="text-xs text-emerald-700 mt-2">
                    שימוש אמיתי החל ב-
                    {formatDossierDate(selectedEntry.liveStartedAt)}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() =>
                  void handleInitializeForLiveUse(
                    selectedBuildingId,
                    selectedDossier.buildingName
                  )
                }
                className="text-xs font-semibold rounded-lg border border-amber-400 text-amber-900 bg-amber-50 px-3 py-2 hover:bg-amber-100"
              >
                אתחל בניין לשימוש אמיתי
              </button>
            </div>
          </div>

          <BuildingDossierPanel dossier={selectedDossier} />

          <MasterProfessionalAssessmentPanel
            buildingId={selectedBuildingId}
            buildingName={selectedDossier.buildingName}
            faults={faults}
            elevators={selectedElevators}
            liveStartedAt={selectedEntry?.liveStartedAt ?? null}
          />

          <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-navy">
                  מעליות — {selectedDossier.buildingName}
                </h3>
                <p className="text-xs text-gray-text">
                  {selectedDossier.elevatorCount} מעליות · בחרו מעלית מהרשימה
                </p>
              </div>
              {selectedBuilding && (
                <button
                  type="button"
                  onClick={openAddElevator}
                  className="text-xs font-semibold bg-navy text-white px-3 py-1.5 rounded-lg"
                >
                  הוסף מעלית
                </button>
              )}
            </div>

            {selectedElevators.length === 0 &&
            selectedDossier.faultsByElevator.length === 0 ? (
              <p className="text-sm text-gray-text">אין מעליות רשומות לבניין זה.</p>
            ) : (
              <ul className="space-y-2">
                {selectedElevators.map((e) => (
                  <li
                    key={e.id}
                    className="border rounded-xl px-3 py-2 border-gray-200"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="text-right flex-1">
                        <p className="font-semibold text-navy text-sm">
                          {e.elevator_name}
                        </p>
                        <p className="text-xs text-gray-text">
                          {e.elevator_id} · {e.status}
                          {!e.is_active ? " · מושבתת" : ""}
                          {e.floors_count ? ` · ${e.floors_count} קומות` : ""}
                          · {faultCountForElevator(e.elevator_id)} תקלות
                        </p>
                        {selectedBuildingId && (
                          <ElevatorDossierLink
                            buildingId={selectedBuildingId}
                            elevatorId={e.elevator_id}
                          />
                        )}
                      </div>
                      {selectedBuilding && (
                        <div className="flex flex-wrap gap-1">
                          <ActionBtn
                            label="ערוך"
                            onClick={() => openEditElevator(e)}
                          />
                          <ActionBtn
                            label={e.is_active ? "השבת" : "הפעל"}
                            onClick={() => void handleToggleElevator(e)}
                          />
                          <ActionBtn
                            label="מחק"
                            danger
                            onClick={() => void handleDeleteElevator(e)}
                          />
                        </div>
                      )}
                    </div>
                  </li>
                ))}

                {selectedDossier.faultsByElevator
                  .filter(
                    (item) =>
                      !selectedElevators.some(
                        (e) => e.elevator_id === item.elevatorId
                      )
                  )
                  .map((item) => (
                    <li
                      key={item.elevatorId}
                      className="border rounded-xl px-3 py-2 border-dashed border-gray-200"
                    >
                      <div className="text-right w-full">
                        <p className="font-semibold text-navy text-sm">
                          {item.elevatorName}
                        </p>
                        <p className="text-xs text-gray-text">
                          {item.elevatorId} · מדיווחים בלבד · {item.count} תקלות
                        </p>
                        {selectedBuildingId && (
                          <ElevatorDossierLink
                            buildingId={selectedBuildingId}
                            elevatorId={item.elevatorId}
                          />
                        )}
                      </div>
                    </li>
                  ))}
              </ul>
            )}
          </div>

          <FaultHistoryTable
            title="היסטוריית תקלות הבניין"
            faults={selectedDossier.faults}
          />
        </>
      )}

      {showElevatorForm && selectedBuildingId && (
        <form
          onSubmit={(e) => void handleSaveElevator(e)}
          className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3"
        >
          <h3 className="text-sm font-bold text-navy">
            {editingElevator ? "עריכת מעלית" : "הוספת מעלית"}
          </h3>
          <FormField label="מזהה מעלית">
            <input
              className="form-input"
              value={elevatorForm.elevatorId}
              onChange={(e) =>
                setElevatorForm((f) => ({ ...f, elevatorId: e.target.value }))
              }
              disabled={Boolean(editingElevator)}
              dir="ltr"
              required={!editingElevator}
            />
          </FormField>
          <FormField label="שם מעלית">
            <input
              className="form-input"
              value={elevatorForm.elevatorName}
              onChange={(e) =>
                setElevatorForm((f) => ({ ...f, elevatorName: e.target.value }))
              }
              required
            />
          </FormField>
          <div className="grid grid-cols-2 gap-2">
            <FormField label="מספר קומות">
              <input
                type="number"
                className="form-input"
                value={elevatorForm.floorsCount}
                onChange={(e) =>
                  setElevatorForm((f) => ({ ...f, floorsCount: e.target.value }))
                }
                min={0}
              />
            </FormField>
            <FormField label="סוג מעלית">
              <input
                className="form-input"
                value={elevatorForm.elevatorType}
                onChange={(e) =>
                  setElevatorForm((f) => ({
                    ...f,
                    elevatorType: e.target.value,
                  }))
                }
              />
            </FormField>
          </div>
          <FormField label="סטטוס">
            <select
              className="form-input"
              value={elevatorForm.status}
              onChange={(e) =>
                setElevatorForm((f) => ({
                  ...f,
                  status: e.target.value as ElevatorStatusOption,
                }))
              }
            >
              {ELEVATOR_STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </FormField>
          <div className="flex gap-2">
            <button type="submit" className="btn-primary flex-1">
              שמור מעלית
            </button>
            <button
              type="button"
              onClick={() => setShowElevatorForm(false)}
              className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold"
            >
              ביטול
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

function ElevatorDossierLink({
  buildingId,
  elevatorId,
}: {
  buildingId: string;
  elevatorId: string;
}) {
  const href = buildMasterElevatorDossierPath(buildingId, elevatorId);

  return (
    <Link
      href={href}
      className="mt-1.5 inline-flex text-xs font-semibold text-gold hover:underline cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-gold rounded"
    >
      לחצו לצפייה בתיק המעלית
    </Link>
  );
}

function BuildingDossierPanel({
  dossier,
}: {
  dossier: ReturnType<typeof buildBuildingDossier>;
}) {
  const healthStyle = getHealthLevelClasses(dossier.healthLevel);

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3">
      <div>
        <h3 className="text-sm font-bold text-navy">תיק בניין — {dossier.buildingName}</h3>
        <p className="text-xs text-gray-text mt-0.5">{dossier.buildingId}</p>
      </div>

      <div
        className={`rounded-xl border p-3 ${healthStyle.bg} ${healthStyle.border}`}
      >
        <p className="text-xs font-semibold text-gray-text">ציון בריאות בניין</p>
        <p className={`text-2xl font-bold mt-0.5 ${healthStyle.text}`}>
          {dossier.healthScore}
          <span className="text-sm font-semibold mr-1">/100</span>
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <DossierKpi label='סה"כ תקלות' value={dossier.totalFaults} />
        <DossierKpi label="תקלות פתוחות" value={dossier.openFaults} />
        <DossierKpi label="תקלות סגורות" value={dossier.closedFaults} />
        <DossierKpi label="מספר מעליות" value={dossier.elevatorCount} />
        <DossierKpi label="תקלות חוזרות" value={dossier.recurringCount} />
        <DossierKpi
          label="תקלה אחרונה"
          value={formatDossierDate(dossier.lastFaultDate)}
          small
        />
      </div>

      {dossier.faultsByElevator.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gold mb-2">תקלות לפי מעלית</p>
          <ul className="space-y-1">
            {dossier.faultsByElevator.map((item) => (
              <li
                key={item.elevatorId}
                className="text-sm text-navy flex justify-between gap-2 border border-gray-100 rounded-lg px-2 py-1"
              >
                <span>{item.elevatorName}</span>
                <span className="font-semibold">{item.count}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function FaultHistoryTable({
  title,
  faults,
  compact = false,
}: {
  title: string;
  faults: PilotCloudFault[];
  compact?: boolean;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3">
      <h3 className="text-sm font-bold text-navy">{title}</h3>
      {faults.length === 0 ? (
        <p className="text-sm text-gray-text">אין תקלות רשומות.</p>
      ) : (
        <div className="overflow-x-auto -mx-1">
          <table className="w-full min-w-[36rem] text-sm">
            <thead>
              <tr className="text-xs text-gray-text border-b border-gray-200">
                <th className="text-right py-2 px-2 font-semibold">תאריך</th>
                <th className="text-right py-2 px-2 font-semibold">מעלית</th>
                <th className="text-right py-2 px-2 font-semibold">סוג תקלה</th>
                {!compact && (
                  <th className="text-right py-2 px-2 font-semibold">תיאור</th>
                )}
                <th className="text-right py-2 px-2 font-semibold">סטטוס</th>
              </tr>
            </thead>
            <tbody>
              {faults.map((f) => (
                <tr key={f.id} className="border-b border-gray-100 align-top">
                  <td className="py-2 px-2 whitespace-nowrap text-xs">
                    {formatDossierDate(f.created_at)}
                  </td>
                  <td className="py-2 px-2 text-xs">{f.elevator_name}</td>
                  <td className="py-2 px-2 text-xs">{f.fault_type}</td>
                  {!compact && (
                    <td className="py-2 px-2 text-xs text-navy/80 max-w-[12rem]">
                      {f.description}
                    </td>
                  )}
                  <td className="py-2 px-2 text-xs font-semibold">{f.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function DossierKpi({
  label,
  value,
  small = false,
}: {
  label: string;
  value: string | number;
  small?: boolean;
}) {
  return (
    <div className="bg-gray-light rounded-xl px-3 py-2 border border-gray-200">
      <p className="text-[11px] text-gray-text">{label}</p>
      <p
        className={`font-bold text-navy mt-0.5 ${small ? "text-xs" : "text-lg"}`}
      >
        {value}
      </p>
    </div>
  );
}

function FormField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-xs text-gray-text">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

function ActionBtn({
  label,
  onClick,
  danger = false,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-xs font-semibold px-2 py-1 rounded-lg border ${
        danger
          ? "border-red-200 text-red-700"
          : "border-gray-200 text-navy hover:bg-gray-50"
      }`}
    >
      {label}
    </button>
  );
}
