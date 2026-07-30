"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import MasterLetterForm, {
  buildLetterDraftFromForm,
} from "@/components/MasterLetterForm";
import {
  formatDocumentDate,
  isDocumentCenterConfigured,
  type DocumentRecord,
} from "@/lib/document-center";
import {
  getAllCloudBuildingsWithMeta,
  getAllCloudElevators,
  type CloudBuildingRow,
  type CloudElevatorRow,
} from "@/lib/buildings-cloud";
import { buildMasterBuildingList } from "@/lib/master-buildings-list";
import type { MasterBuildingSearchHit } from "@/lib/master-building-search";
import {
  getAllBuildingIds,
  getBuildingDataset,
  getStaticDemoBuildingMeta,
} from "@/lib/buildings";
import { isPilotCloudConfigured } from "@/lib/pilot-cloud";
import {
  listMasterLetters,
  saveMasterLetterToDocumentCenter,
  type MasterLetterFieldValue,
  type MasterLetterTemplateId,
} from "@/lib/master-letters";
import {
  getDefaultMasterLetterTemplateId,
  getMasterLetterTemplate,
  MASTER_LETTER_TEMPLATES,
} from "@/lib/master-letter-templates";

function resolveBuildingName(buildingId: string): string {
  try {
    return getBuildingDataset(buildingId).building.name;
  } catch {
    return buildingId;
  }
}

function resolveElevatorOptions(
  buildingId: string,
  elevatorsByBuilding: Record<string, CloudElevatorRow[]>
): Array<{ id: string; name: string }> {
  const cloudElevators = elevatorsByBuilding[buildingId] ?? [];
  if (cloudElevators.length > 0) {
    return cloudElevators
      .filter((elevator) => elevator.is_active)
      .map((elevator) => ({
        id: elevator.elevator_id,
        name: elevator.elevator_name,
      }));
  }

  try {
    return getBuildingDataset(buildingId).elevators.map((elevator) => ({
      id: elevator.id,
      name: elevator.name,
    }));
  } catch {
    return [];
  }
}

export default function MasterLettersSection() {
  const documentCenterReady = isDocumentCenterConfigured();
  const cloudReadyForBuildings = isPilotCloudConfigured();

  const [letters, setLetters] = useState<DocumentRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"list" | "create">("list");

  const [cloudBuildings, setCloudBuildings] = useState<CloudBuildingRow[]>([]);
  const [elevatorsByBuilding, setElevatorsByBuilding] = useState<
    Record<string, CloudElevatorRow[]>
  >({});
  const [templateId, setTemplateId] = useState<MasterLetterTemplateId>(
    getDefaultMasterLetterTemplateId
  );
  const [templateFields, setTemplateFields] = useState<
    Record<string, MasterLetterFieldValue>
  >({});
  const [selectedBuildingHit, setSelectedBuildingHit] =
    useState<MasterBuildingSearchHit | null>(null);
  const [elevatorId, setElevatorId] = useState("");
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [customNote, setCustomNote] = useState("");
  const [showPreview, setShowPreview] = useState(false);

  const buildingEntries = useMemo(
    () =>
      buildMasterBuildingList({
        cloudBuildings,
        demoBuildingIds: getAllBuildingIds(),
        resolveDemoName: (id) => {
          try {
            return getBuildingDataset(id).building.name;
          } catch {
            return getStaticDemoBuildingMeta(id).name;
          }
        },
        resolveDemoCity: (id) => {
          try {
            return getBuildingDataset(id).building.city;
          } catch {
            return getStaticDemoBuildingMeta(id).city;
          }
        },
        faultBuildings: [],
      }),
    [cloudBuildings]
  );

  const resolveElevatorCount = useCallback(
    (buildingId: string) => resolveElevatorOptions(buildingId, elevatorsByBuilding).length,
    [elevatorsByBuilding]
  );

  const selectedBuildingId = selectedBuildingHit?.profile.buildingId ?? "";
  const elevatorOptions = useMemo(
    () => resolveElevatorOptions(selectedBuildingId, elevatorsByBuilding),
    [selectedBuildingId, elevatorsByBuilding]
  );

  const refreshLetters = useCallback(async () => {
    if (!documentCenterReady) {
      setLetters([]);
      setError("Supabase / מאגר מסמכים לא מוגדר.");
      return;
    }

    setLoading(true);
    const result = await listMasterLetters();
    setLetters(result.letters);
    setError(result.error);
    setLoading(false);
  }, [documentCenterReady]);

  useEffect(() => {
    void refreshLetters();
  }, [refreshLetters]);

  useEffect(() => {
    if (!cloudReadyForBuildings) return;

    let cancelled = false;
    void Promise.all([getAllCloudBuildingsWithMeta(), getAllCloudElevators()]).then(
      ([buildingsResult, elevators]) => {
        if (cancelled) return;
        setCloudBuildings(buildingsResult.rows);
        const grouped: Record<string, CloudElevatorRow[]> = {};
        for (const elevator of elevators) {
          const key = elevator.building_id;
          grouped[key] = grouped[key] ?? [];
          grouped[key].push(elevator);
        }
        setElevatorsByBuilding(grouped);
      }
    );

    return () => {
      cancelled = true;
    };
  }, [cloudReadyForBuildings]);

  useEffect(() => {
    setElevatorId("");
  }, [selectedBuildingId]);

  function resetCreateForm(nextTemplateId?: MasterLetterTemplateId) {
    const resolvedTemplateId = nextTemplateId ?? templateId;
    setTemplateId(resolvedTemplateId);
    setTemplateFields({});
    setSelectedBuildingHit(null);
    setElevatorId("");
    setTitle("");
    setSubject(getMasterLetterTemplate(resolvedTemplateId)?.defaultSubject ?? "");
    setCustomNote("");
    setShowPreview(false);
    setMessage(null);
    setError(null);
  }

  function handleTemplateChange(nextTemplateId: MasterLetterTemplateId) {
    resetCreateForm(nextTemplateId);
  }

  function handleTemplateFieldChange(fieldId: string, value: MasterLetterFieldValue) {
    setTemplateFields((current) => ({ ...current, [fieldId]: value }));
  }

  function openCreateForm() {
    resetCreateForm(getDefaultMasterLetterTemplateId());
    setMode("create");
  }

  async function handleSaveLetter() {
    setMessage(null);
    setError(null);

    const draft = buildLetterDraftFromForm({
      templateId,
      templateFields,
      selectedBuildingHit,
      elevatorId,
      elevatorOptions,
      subject,
      customNote,
    });

    if (!draft) {
      setError("יש לבחור בניין קיים לפני שמירה.");
      return;
    }

    if (!title.trim()) {
      setError("יש להזין כותרת למכתב.");
      return;
    }

    setSaving(true);
    const result = await saveMasterLetterToDocumentCenter({
      ...draft,
      title: title.trim(),
    });
    setSaving(false);

    if (!result.document) {
      setError(result.error ?? "שמירת המכתב נכשלה.");
      return;
    }

    setMessage("המכתב נשמר במאגר המסמכים.");
    setMode("list");
    resetCreateForm();
    await refreshLetters();
  }

  if (!documentCenterReady) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 p-6 text-center">
        <p className="text-sm text-gray-text">
          מאגר המסמכים לא מוגדר. הגדירו Supabase כדי ליצור ולשמור מכתבים.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-navy">מכתבים</h2>
          <p className="text-sm text-gray-text">
            יצירת מכתבים ושמירה אוטומטית במאגר המסמכים עם תגית &quot;מכתב&quot;.
          </p>
        </div>
        {mode === "list" ? (
          <button type="button" onClick={openCreateForm} className="btn-primary">
            מכתב חדש
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              setMode("list");
              resetCreateForm();
            }}
            className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-navy"
          >
            חזרה לרשימה
          </button>
        )}
      </div>

      {message && (
        <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
          {message}
        </p>
      )}
      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          {error}
        </p>
      )}

      {mode === "create" ? (
        <div className="space-y-4 max-w-3xl">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {MASTER_LETTER_TEMPLATES.map((template) => (
              <button
                key={template.id}
                type="button"
                onClick={() => handleTemplateChange(template.id)}
                className={`rounded-xl border px-3 py-2 text-right text-sm transition-colors ${
                  templateId === template.id
                    ? "border-gold bg-gold/10 text-navy font-semibold"
                    : "border-gray-200 bg-white text-navy hover:bg-gray-50"
                }`}
              >
                {template.label}
              </button>
            ))}
          </div>
          <MasterLetterForm
            entries={buildingEntries}
            resolveElevatorCount={resolveElevatorCount}
            templateId={templateId}
            onTemplateIdChange={handleTemplateChange}
            templateFields={templateFields}
            onTemplateFieldChange={handleTemplateFieldChange}
            selectedBuildingHit={selectedBuildingHit}
            onSelectBuildingHit={setSelectedBuildingHit}
            elevatorOptions={elevatorOptions}
            elevatorId={elevatorId}
            onElevatorIdChange={setElevatorId}
            title={title}
            onTitleChange={setTitle}
            subject={subject}
            onSubjectChange={setSubject}
            customNote={customNote}
            onCustomNoteChange={setCustomNote}
            showPreview={showPreview}
            onTogglePreview={() => setShowPreview((value) => !value)}
          />
          <button
            type="button"
            onClick={() => void handleSaveLetter()}
            disabled={saving}
            className="btn-primary w-full md:w-auto"
          >
            {saving ? "שומר..." : "שמור למאגר המסמכים"}
          </button>
        </div>
      ) : loading ? (
        <p className="text-sm text-gray-text text-center py-8">טוען מכתבים...</p>
      ) : letters.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center space-y-3">
          <p className="text-sm text-gray-text">עדיין אין מכתבים שמורים.</p>
          <button type="button" onClick={openCreateForm} className="btn-primary">
            צור מכתב ראשון
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[44rem] text-sm">
              <thead className="bg-gray-light text-gray-text">
                <tr>
                  <th className="text-right font-semibold px-4 py-3">כותרת</th>
                  <th className="text-right font-semibold px-4 py-3">בניין</th>
                  <th className="text-right font-semibold px-4 py-3">מעלית</th>
                  <th className="text-right font-semibold px-4 py-3">תאריך</th>
                  <th className="text-right font-semibold px-4 py-3">קובץ</th>
                </tr>
              </thead>
              <tbody>
                {letters.map((letter) => (
                  <tr key={letter.id} className="border-t border-gray-100">
                    <td className="px-4 py-3 font-medium text-navy">{letter.title}</td>
                    <td className="px-4 py-3 text-gray-text">
                      {resolveBuildingName(letter.building_id)}
                    </td>
                    <td className="px-4 py-3 text-gray-text">
                      {letter.elevator_id ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-text">
                      {formatDocumentDate(letter.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      {letter.file_url ? (
                        <a
                          href={letter.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-gold font-semibold hover:underline"
                        >
                          פתיחה
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
