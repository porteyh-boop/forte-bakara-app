"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAppVersion } from "@/components/AppVersionProvider";
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
import {
  findMasterBuildingById,
  type MasterBuildingSearchHit,
} from "@/lib/master-building-search";
import {
  getAllBuildingIds,
  getBuildingDataset,
  getStaticDemoBuildingMeta,
} from "@/lib/buildings";
import { isPilotCloudConfigured } from "@/lib/pilot-cloud";
import type { ProjectContactWithDetails } from "@/lib/contacts";
import {
  createMasterLetterPartyEntry,
  validateLetterParties,
  type MasterLetterPartyEntry,
} from "@/lib/master-letter-parties";
import {
  isProjectContactsConfigured,
  listProjectContacts,
} from "@/lib/project-contacts-cloud";
import {
  getMasterLetterListDisplay,
  type MasterLetterDossierSection,
  type MasterLetterInspectorFollowUpMetadata,
} from "@/lib/master-letter-metadata";
import {
  listMasterLetters,
  deleteSavedMasterLetter,
  saveMasterLetterToDocumentCenter,
  type MasterLetterFieldValue,
  type MasterLetterTemplateId,
} from "@/lib/master-letters";
import {
  getDefaultMasterLetterTemplateId,
  getMasterLetterTemplate,
  MASTER_LETTER_TEMPLATES,
} from "@/lib/master-letter-templates";
import {
  listNotificationsByDocumentId,
  type InspectorLetterStage,
} from "@/lib/document-inspector-notifications";
import {
  buildInspectorFollowUpLetterPrefill,
  suggestElevatorCompanyContact,
} from "@/lib/inspector-follow-up-letters";
import {
  getPreparedStagesForReportId,
  recordInspectorLetterPreparedIfDocumentBased,
} from "@/lib/inspector-follow-up-prepared-stages";
import { getInspectorReportById } from "@/lib/inspector-report-tracking";
import { getAllDocuments } from "@/lib/document-center";
import {
  ForteV2DangerButton,
  ForteV2Dialog,
  ForteV2DialogOverlay,
  ForteV2SecondaryButton,
} from "@/components/master-v2/project-v2/MasterProjectV2Workspace";

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

function createInitialRecipientEntry(
  projectContacts: ProjectContactWithDetails[]
): MasterLetterPartyEntry {
  const entry = createMasterLetterPartyEntry(
    projectContacts.length > 0 ? "contact" : "manual"
  );
  if (projectContacts[0]) {
    entry.contactRelationId = projectContacts[0].id;
  }
  return entry;
}

function parseInspectorLetterStage(
  value: string | null
): InspectorLetterStage | null {
  if (value === "letter_1" || value === "letter_2" || value === "letter_3") {
    return value;
  }
  return null;
}

interface MasterLettersSectionProps {
  fixedBuildingId?: string;
  embedded?: boolean;
}

export default function MasterLettersSection({
  fixedBuildingId,
  embedded = false,
}: MasterLettersSectionProps = {}) {
  const searchParams = useSearchParams();
  const { guardSensitiveAction } = useAppVersion();
  const documentCenterReady = isDocumentCenterConfigured();
  const cloudReadyForBuildings = isPilotCloudConfigured();
  const inspectorPrefillAppliedRef = useRef<string | null>(null);

  const [letters, setLetters] = useState<DocumentRecord[]>([]);
  const [projectContacts, setProjectContacts] = useState<
    ProjectContactWithDetails[]
  >([]);
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
  const [recipientEntries, setRecipientEntries] = useState<MasterLetterPartyEntry[]>(
    () => [createMasterLetterPartyEntry("manual")]
  );
  const [ccEntries, setCcEntries] = useState<MasterLetterPartyEntry[]>([]);
  const [dossierSection, setDossierSection] =
    useState<MasterLetterDossierSection>("general");
  const [showPreview, setShowPreview] = useState(false);
  const [search, setSearch] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<DocumentRecord | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [inspectorFollowUpContext, setInspectorFollowUpContext] =
    useState<MasterLetterInspectorFollowUpMetadata | null>(null);

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

  const refreshProjectContacts = useCallback(async () => {
    if (!fixedBuildingId || !isProjectContactsConfigured()) {
      setProjectContacts([]);
      return;
    }

    const result = await listProjectContacts(fixedBuildingId);
    setProjectContacts(result.contacts);
    setRecipientEntries((current) => {
      if (current.length !== 1) return current;
      const only = current[0];
      if (only.source !== "contact" || only.contactRelationId) return current;
      if (result.contacts.length === 0) {
        return [{ ...only, source: "manual" as const }];
      }
      return [
        {
          ...only,
          source: "contact" as const,
          contactRelationId: result.contacts[0].id,
        },
      ];
    });
  }, [fixedBuildingId]);

  useEffect(() => {
    void refreshLetters();
  }, [refreshLetters]);

  useEffect(() => {
    void refreshProjectContacts();
  }, [refreshProjectContacts]);

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

  useEffect(() => {
    if (!fixedBuildingId) return;
    const hit = findMasterBuildingById(
      buildingEntries,
      fixedBuildingId,
      resolveElevatorCount
    );
    if (hit) setSelectedBuildingHit(hit);
  }, [fixedBuildingId, buildingEntries, resolveElevatorCount]);

  useEffect(() => {
    const inspectorDocId = searchParams.get("inspectorDocId")?.trim() ?? "";
    const letterStage = parseInspectorLetterStage(
      searchParams.get("letterStage")
    );
    if (!fixedBuildingId || !inspectorDocId || !letterStage) return;

    const prefillKey = `${inspectorDocId}:${letterStage}`;
    if (inspectorPrefillAppliedRef.current === prefillKey) return;

    let cancelled = false;

    void (async () => {
      const report = await getInspectorReportById(inspectorDocId);
      if (cancelled || !report || report.building_id !== fixedBuildingId) return;

      const notifications = await listNotificationsByDocumentId(inspectorDocId);
      const documentsResult = await getAllDocuments();
      const preparedStages = getPreparedStagesForReportId(
        inspectorDocId,
        notifications,
        documentsResult.documents
      );
      const cloudBuilding =
        cloudBuildings.find((row) => row.building_id === fixedBuildingId) ??
        null;
      const options = resolveElevatorOptions(fixedBuildingId, elevatorsByBuilding);
      const elevatorLabel = report.elevator_id
        ? (options.find((item) => item.id === report.elevator_id)?.name ?? null)
        : null;
      const suggestedContact = suggestElevatorCompanyContact(
        projectContacts,
        cloudBuilding?.elevator_company
      );

      const prefill = buildInspectorFollowUpLetterPrefill({
        stage: letterStage,
        report,
        buildingName: resolveBuildingName(fixedBuildingId),
        elevatorLabel,
        elevatorCompany: cloudBuilding?.elevator_company,
        preparedStages,
        suggestedContact,
      });

      if (cancelled) return;

      setTemplateId(prefill.templateId);
      setTemplateFields(prefill.templateFields);
      setSubject(prefill.subject);
      setTitle(prefill.title);
      setDossierSection(prefill.dossierSection);
      setElevatorId(prefill.elevatorId ?? "");
      setCustomNote("");
      setInspectorFollowUpContext({
        reportDocumentId: prefill.inspectorReportDocumentId,
        letterStage: prefill.letterStage,
      });
      setRecipientEntries(
        prefill.suggestedContactRelationId
          ? [
              {
                ...createMasterLetterPartyEntry("contact"),
                contactRelationId: prefill.suggestedContactRelationId,
              },
            ]
          : [createMasterLetterPartyEntry("manual")]
      );
      setCcEntries([]);
      setShowPreview(true);
      setMode("create");
      inspectorPrefillAppliedRef.current = prefillKey;
    })();

    return () => {
      cancelled = true;
    };
  }, [
    fixedBuildingId,
    searchParams,
    cloudBuildings,
    elevatorsByBuilding,
    projectContacts,
  ]);

  const displayedLetters = useMemo(() => {
    let list = letters;
    if (fixedBuildingId) {
      list = list.filter((letter) => letter.building_id === fixedBuildingId);
    }
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter((letter) => {
      const display = getMasterLetterListDisplay(letter);
      return [
        letter.title,
        display.subject,
        display.recipient,
        display.templateLabel,
        display.sectionLabel,
        resolveBuildingName(letter.building_id),
      ]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [letters, fixedBuildingId, search]);

  function resetCreateForm(nextTemplateId?: MasterLetterTemplateId) {
    const resolvedTemplateId = nextTemplateId ?? templateId;
    setTemplateId(resolvedTemplateId);
    setTemplateFields({});
    if (!fixedBuildingId) {
      setSelectedBuildingHit(null);
    }
    setElevatorId("");
    setTitle("");
    setSubject(getMasterLetterTemplate(resolvedTemplateId)?.defaultSubject ?? "");
    setCustomNote("");
    setRecipientEntries([createInitialRecipientEntry(projectContacts)]);
    setCcEntries([]);
    setDossierSection("general");
    setShowPreview(false);
    setMessage(null);
    setError(null);
    setInspectorFollowUpContext(null);
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
    if (!guardSensitiveAction()) return;

    setMessage(null);
    setError(null);

    const validationError = validateLetterParties(
      recipientEntries,
      ccEntries,
      projectContacts
    );
    if (validationError) {
      setError(validationError);
      return;
    }

    const draft = buildLetterDraftFromForm({
      templateId,
      templateFields,
      selectedBuildingHit,
      elevatorId,
      elevatorOptions,
      subject,
      customNote,
      recipientEntries,
      ccEntries,
      projectContacts,
      dossierSection,
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
      inspectorFollowUp: inspectorFollowUpContext,
    });
    setSaving(false);

    if (!result.document) {
      setError(result.error ?? "שמירת המכתב נכשלה.");
      return;
    }

    if (inspectorFollowUpContext) {
      await recordInspectorLetterPreparedIfDocumentBased({
        reportDocumentId: inspectorFollowUpContext.reportDocumentId,
        letterStage: inspectorFollowUpContext.letterStage,
      });
    }

    setMessage("המכתב הופק ונשמר בתיק הבניין.");
    setMode("list");
    resetCreateForm();
    await refreshLetters();
  }

  async function confirmDeleteLetter() {
    if (!deleteTarget || !guardSensitiveAction()) return;

    setDeleting(true);
    setMessage(null);
    setError(null);

    const result = await deleteSavedMasterLetter(deleteTarget.id);
    setDeleting(false);

    if (!result.ok) {
      setError(result.error ?? "מחיקת המכתב נכשלה.");
      return;
    }

    setDeleteTarget(null);
    setMessage("המכתב נמחק.");
    await refreshLetters();
  }

  function requestDeleteLetter(letter: DocumentRecord) {
    if (!embedded) {
      const letterName = letter.title.trim() || "ללא שם";
      const confirmed = window.confirm(
        `האם למחוק את המכתב '${letterName}'?\nפעולה זו אינה ניתנת לביטול.`
      );
      if (!confirmed) return;
      void (async () => {
        if (!guardSensitiveAction()) return;
        setDeleting(true);
        setMessage(null);
        setError(null);
        const result = await deleteSavedMasterLetter(letter.id);
        setDeleting(false);
        if (!result.ok) {
          setError(result.error ?? "מחיקת המכתב נכשלה.");
          return;
        }
        setMessage("המכתב נמחק.");
        await refreshLetters();
      })();
      return;
    }

    setDeleteTarget(letter);
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
      {!embedded && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-navy">מכתבים</h2>
            <p className="text-sm text-gray-text">
              יצירת מכתבים מקצועיים — נשמרים אוטומטית בתיק הבניין.
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
      )}
      {embedded && mode === "list" && (
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-gray-100">
          <button type="button" onClick={openCreateForm} className="btn-primary text-xs py-1.5 px-3">
            מכתב חדש
          </button>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="חיפוש..."
            className="w-full sm:w-72 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs text-navy placeholder:text-gray-text"
          />
        </div>
      )}
      {embedded && mode === "create" && (
        <button
          type="button"
          onClick={() => {
            setMode("list");
            resetCreateForm();
          }}
          className="text-xs font-semibold text-navy border border-gray-200 rounded-md px-3 py-1.5 hover:bg-gray-50"
        >
          חזרה לרשימה
        </button>
      )}

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
                <span className="block font-semibold">{template.label}</span>
                <span className="block text-[11px] text-gray-text mt-0.5">
                  {template.description}
                </span>
              </button>
            ))}
          </div>
          <MasterLetterForm
            entries={buildingEntries}
            resolveElevatorCount={resolveElevatorCount}
            fixedBuildingId={fixedBuildingId}
            projectContacts={projectContacts}
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
            recipientEntries={recipientEntries}
            onRecipientEntriesChange={setRecipientEntries}
            ccEntries={ccEntries}
            onCcEntriesChange={setCcEntries}
            dossierSection={dossierSection}
            onDossierSectionChange={setDossierSection}
            showPreview={showPreview}
            onTogglePreview={() => setShowPreview((value) => !value)}
          />
          <button
            type="button"
            onClick={() => void handleSaveLetter()}
            disabled={saving}
            className="btn-primary w-full md:w-auto"
          >
            {saving ? "מפיק ושומר..." : "הפק ושמור"}
          </button>
        </div>
      ) : loading ? (
        <p className="text-sm text-gray-text text-center py-8">טוען מכתבים...</p>
      ) : displayedLetters.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center space-y-3">
          <p className="text-sm text-gray-text">
            {search.trim() ? "לא נמצאו מכתבים התואמים לחיפוש." : "עדיין אין מכתבים שמורים."}
          </p>
          {!search.trim() && (
            <button type="button" onClick={openCreateForm} className="btn-primary">
              צור מכתב ראשון
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[52rem] text-sm">
              <thead className="bg-gray-light text-gray-text">
                <tr>
                  <th className="text-right font-semibold px-4 py-3">תאריך</th>
                  <th className="text-right font-semibold px-4 py-3">נושא</th>
                  <th className="text-right font-semibold px-4 py-3">נמען</th>
                  <th className="text-right font-semibold px-4 py-3">סוג</th>
                  <th className="text-right font-semibold px-4 py-3">תחום</th>
                  {!embedded && (
                    <th className="text-right font-semibold px-4 py-3">בניין</th>
                  )}
                  <th className="text-right font-semibold px-4 py-3">קובץ</th>
                  <th className="text-right font-semibold px-4 py-3">סטטוס</th>
                  <th className="text-right font-semibold px-4 py-3">פעולות</th>
                </tr>
              </thead>
              <tbody>
                {displayedLetters.map((letter) => {
                  const display = getMasterLetterListDisplay(letter);
                  return (
                    <tr key={letter.id} className="border-t border-gray-100">
                      <td className="px-4 py-3 text-gray-text whitespace-nowrap">
                        {formatDocumentDate(letter.created_at)}
                      </td>
                      <td className="px-4 py-3 font-medium text-navy">
                        {display.subject}
                      </td>
                      <td className="px-4 py-3 text-gray-text">
                        {display.recipient}
                      </td>
                      <td className="px-4 py-3 text-gray-text">
                        {display.templateLabel}
                      </td>
                      <td className="px-4 py-3 text-gray-text">
                        {display.sectionLabel}
                      </td>
                      {!embedded && (
                        <td className="px-4 py-3 text-gray-text">
                          {resolveBuildingName(letter.building_id)}
                        </td>
                      )}
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
                      <td className="px-4 py-3 text-gray-text text-xs">
                        {display.isHistorical
                          ? "היסטורי — ללא עריכה"
                          : "ניתן לעריכה עתידית"}
                      </td>
                      <td className="px-4 py-3">
                        {embedded ? (
                          <ForteV2DangerButton
                            outline
                            disabled={deleting}
                            onClick={() => requestDeleteLetter(letter)}
                          >
                            מחק
                          </ForteV2DangerButton>
                        ) : (
                          <button
                            type="button"
                            disabled={deleting}
                            onClick={() => requestDeleteLetter(letter)}
                            className="text-red-600 text-xs font-semibold hover:underline disabled:opacity-50"
                          >
                            מחק
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {embedded && deleteTarget && (
        <ForteV2DialogOverlay
          onClose={() => {
            if (deleting) return;
            setDeleteTarget(null);
          }}
        >
          <ForteV2Dialog
            title="מחיקת מכתב"
            onClose={() => {
              if (deleting) return;
              setDeleteTarget(null);
            }}
          >
            <p className="text-sm text-forte-text-secondary mb-4">
              האם למחוק את המכתב &apos;{deleteTarget.title.trim() || "ללא שם"}&apos;?
              <br />
              פעולה זו אינה ניתנת לביטול.
            </p>
            <div className="flex gap-2">
              <ForteV2DangerButton
                onClick={() => void confirmDeleteLetter()}
                disabled={deleting}
              >
                {deleting ? "מוחק..." : "מחק"}
              </ForteV2DangerButton>
              <ForteV2SecondaryButton
                size="sm"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
              >
                ביטול
              </ForteV2SecondaryButton>
            </div>
          </ForteV2Dialog>
        </ForteV2DialogOverlay>
      )}
    </div>
  );
}
