"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  collectDocumentTags,
  createDocument,
  deleteDocument,
  deleteDocumentCenterStorageFile,
  DOCUMENT_CENTER_MAX_FILE_MB,
  DOCUMENT_PREDEFINED_TAGS,
  DOCUMENT_TYPES,
  filterDocuments,
  formatDocumentDate,
  formatDocumentTags,
  getAllDocuments,
  getDocumentLegacyFilterTags,
  getDocumentTypeLabel,
  getDocumentVisibilityLabel,
  updateDocumentVisibility,
  isDocumentCenterConfigured,
  normalizePredefinedDocumentTags,
  traceDocumentCenter,
  uploadDocumentCenterFile,
  validateDocumentCenterFile,
  validateCreateDocumentInput,
  type DocumentRecord,
  type DocumentTypeId,
  type DocumentVisibility,
  DEFAULT_DOCUMENT_VISIBILITY,
} from "@/lib/document-center";
import { listAllDocumentInspectorMeta } from "@/lib/document-inspector-meta";
import {
  groupNotificationsByDocumentId,
  listAllDocumentInspectorNotifications,
  type DocumentInspectorNotificationRecord,
} from "@/lib/document-inspector-notifications";
import { createInspectorReportWithFile } from "@/lib/inspector-report-tracking";
import {
  InspectorCreateFields,
  InspectorDocumentCard,
} from "@/components/MasterDocumentInspectorPanel";
import type { DocumentInspectorMetaRecord } from "@/lib/document-inspector-meta";
import MasterExistingBuildingSearch from "@/components/MasterExistingBuildingSearch";
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

function visibilityBadgeClass(visibility: DocumentVisibility): string {
  return visibility === "client"
    ? "text-xs font-semibold rounded-full px-2.5 py-1 border bg-emerald-50 text-emerald-800 border-emerald-200"
    : "text-xs font-semibold rounded-full px-2.5 py-1 border bg-slate-50 text-slate-700 border-slate-200";
}

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
): { id: string; name: string }[] {
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

export default function MasterDocumentCenterSection() {
  const cloudReady = isDocumentCenterConfigured();
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);

  const [cloudBuildings, setCloudBuildings] = useState<CloudBuildingRow[]>([]);
  const [elevatorsByBuilding, setElevatorsByBuilding] = useState<
    Record<string, CloudElevatorRow[]>
  >({});
  const [selectedBuildingHit, setSelectedBuildingHit] =
    useState<MasterBuildingSearchHit | null>(null);
  const [elevatorId, setElevatorId] = useState("");
  const [documentType, setDocumentType] = useState<DocumentTypeId>("other");
  const [documentVisibility, setDocumentVisibility] =
    useState<DocumentVisibility>(DEFAULT_DOCUMENT_VISIBILITY);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [inspectorMetaByDocumentId, setInspectorMetaByDocumentId] = useState<
    Record<string, DocumentInspectorMetaRecord>
  >({});
  const [inspectorNotificationsByDocumentId, setInspectorNotificationsByDocumentId] =
    useState<Record<string, DocumentInspectorNotificationRecord[]>>({});
  const [reportDate, setReportDate] = useState(
    () => new Date().toISOString().split("T")[0]
  );
  const [inspectorName, setInspectorName] = useState("");
  const [hasRemarks, setHasRemarks] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [filterBuildingId, setFilterBuildingId] = useState("");
  const [filterDocumentType, setFilterDocumentType] = useState<DocumentTypeId | "">(
    ""
  );
  const [filterTag, setFilterTag] = useState("");

  const buildingId = selectedBuildingHit?.profile.buildingId ?? "";

  const cloudReadyForBuildings = isPilotCloudConfigured();

  const buildingOptions = useMemo(
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
    (id: string) => {
      const cloudCount = elevatorsByBuilding[id]?.length ?? 0;
      if (cloudCount > 0) return cloudCount;
      try {
        return getBuildingDataset(id).elevators.length;
      } catch {
        return 0;
      }
    },
    [elevatorsByBuilding]
  );

  const elevatorOptions = useMemo(() => {
    if (!buildingId) return [];
    return resolveElevatorOptions(buildingId, elevatorsByBuilding);
  }, [buildingId, elevatorsByBuilding]);

  const refreshBuildings = useCallback(async () => {
    if (!cloudReadyForBuildings) {
      setCloudBuildings([]);
      setElevatorsByBuilding({});
      return;
    }

    const [cloudResult, allElevators] = await Promise.all([
      getAllCloudBuildingsWithMeta(),
      getAllCloudElevators(),
    ]);
    setCloudBuildings(cloudResult.rows);

    const grouped: Record<string, CloudElevatorRow[]> = {};
    for (const elevator of allElevators) {
      if (!grouped[elevator.building_id]) grouped[elevator.building_id] = [];
      grouped[elevator.building_id].push(elevator);
    }
    setElevatorsByBuilding(grouped);
  }, [cloudReadyForBuildings]);

  useEffect(() => {
    void refreshBuildings();
  }, [refreshBuildings]);

  const refresh = useCallback(async () => {
    if (!cloudReady) {
      setDocuments([]);
      setListError(null);
      return { documents: [], error: null };
    }
    setLoading(true);
    const [{ documents: rows, error }, metaRows, notificationRows] =
      await Promise.all([
        getAllDocuments(),
        listAllDocumentInspectorMeta(),
        listAllDocumentInspectorNotifications(),
      ]);
    setDocuments(rows);
    setListError(error);
    setInspectorMetaByDocumentId(
      Object.fromEntries(metaRows.map((meta) => [meta.document_id, meta]))
    );
    setInspectorNotificationsByDocumentId(
      groupNotificationsByDocumentId(notificationRows)
    );
    if (error) {
      console.error("[document-center] refresh failed:", error);
    }
    setLoading(false);
    return { documents: rows, error };
  }, [cloudReady]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const legacyFilterTags = useMemo(
    () => getDocumentLegacyFilterTags(documents),
    [documents]
  );

  const availableTags = useMemo(
    () => collectDocumentTags(documents),
    [documents]
  );

  const filteredDocuments = useMemo(
    () =>
      filterDocuments(documents, {
        query: searchQuery,
        buildingId: filterBuildingId || undefined,
        documentType: filterDocumentType || undefined,
        tags: filterTag ? [filterTag] : undefined,
      }),
    [documents, searchQuery, filterBuildingId, filterDocumentType, filterTag]
  );

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setMessage(null);
    setSelectedFile(null);
    setUploadProgress(null);

    if (!file) return;

    const validationError = validateDocumentCenterFile(file);
    if (validationError) {
      setMessage(validationError);
      e.target.value = "";
      return;
    }

    setSelectedFile(file);
    if (!title.trim()) {
      setTitle(file.name.replace(/\.[^.]+$/, ""));
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setUploadProgress(null);

    if (!selectedBuildingHit || !buildingId) {
      setMessage("יש לבחור בניין מהמערכת לפני שמירת המסמך.");
      return;
    }

    if (!selectedFile) {
      setMessage("יש לבחור קובץ להעלאה.");
      return;
    }

    if (documentType === "inspector_report") {
      setCreating(true);
      const created = await createInspectorReportWithFile(
        {
          buildingId,
          elevatorId: elevatorId || null,
          reportDate,
          inspectorName,
          documentName: title || selectedFile.name.replace(/\.[^.]+$/, ""),
          documentDescription: description,
          hasRemarks,
        },
        selectedFile,
        setUploadProgress
      );
      setCreating(false);
      setUploadProgress(null);

      if (!created) {
        setMessage(
          "שמירת תסקיר הבודק נכשלה. ודאו ש-migrations 008 ו-011 הורצו ב-Supabase."
        );
        return;
      }

      setTitle("");
      setDescription("");
      setSelectedTags([]);
      setElevatorId("");
      setSelectedBuildingHit(null);
      setInspectorName("");
      setHasRemarks(false);
      setSelectedFile(null);
      setDocumentType("other");
      setDocumentVisibility(DEFAULT_DOCUMENT_VISIBILITY);
      setMessage(
        created.has_remarks
          ? "תסקיר בודק נשמר במאגר ודוח מעקב נפתח."
          : "תסקיר בודק נשמר במאגר ללא מעקב הערות."
      );
      const refreshed = await refresh();
      if (refreshed.error) {
        setMessage(`התסקיר נשמר, אך טעינת הרשימה נכשלה: ${refreshed.error}`);
      }
      return;
    }

    if (!cloudReady) {
      setMessage("Supabase לא מוגדר. הריצו migration 008.");
      return;
    }

    traceDocumentCenter("submit.start", {
      buildingId,
      buildingName: selectedBuildingHit.profile.name,
      fileName: selectedFile.name,
      fileType: selectedFile.type,
      fileSizeBytes: selectedFile.size,
      documentType,
      title: title.trim() || selectedFile.name,
      elevatorId: elevatorId || null,
      visibility: documentVisibility,
    });

    setCreating(true);
    const uploaded = await uploadDocumentCenterFile(
      selectedFile,
      buildingId,
      setUploadProgress
    );

    if (!uploaded.ok) {
      traceDocumentCenter("submit.upload.failed", {
        stage: uploaded.stage,
        error: uploaded.error,
        details: uploaded.details ?? null,
      });
      setCreating(false);
      setUploadProgress(null);
      setMessage(
        uploaded.details ??
          (uploaded.stage === "validation" ? uploaded.error : "העלאת הקובץ נכשלה")
      );
      return;
    }

    const input = {
      buildingId,
      elevatorId: elevatorId || null,
      documentType,
      title: title.trim() || selectedFile.name,
      description,
      fileName: selectedFile.name,
      fileUrl: uploaded.fileUrl,
      storagePath: uploaded.storagePath,
      mimeType: uploaded.contentType,
      fileSizeBytes: selectedFile.size,
      tags: normalizePredefinedDocumentTags(selectedTags),
      visibility: documentVisibility,
    };

    const validationError = validateCreateDocumentInput(input);
    if (validationError) {
      traceDocumentCenter("submit.pre_insert_validation.failed", {
        error: validationError,
        input,
        note: "upload already succeeded — orphaned file in storage",
      });
      setCreating(false);
      setUploadProgress(null);
      setMessage(validationError);
      return;
    }

    const { document: created, error: insertError } = await createDocument(input);
    setCreating(false);
    setUploadProgress(null);

    if (!created) {
      traceDocumentCenter("submit.insert.failed", {
        insertError,
        storagePath: uploaded.storagePath,
      });
      await deleteDocumentCenterStorageFile(uploaded.storagePath);
      setMessage(
        insertError
          ? `שמירת המסמך נכשלה: ${insertError}`
          : "שמירת המסמך נכשלה."
      );
      console.error("[document-center] save failed after upload:", insertError);
      return;
    }

    traceDocumentCenter("submit.success", {
      documentId: created.id,
      title: created.title,
    });
    setTitle("");
    setDescription("");
    setSelectedTags([]);
    setElevatorId("");
    setSelectedBuildingHit(null);
    setSelectedFile(null);
    setDocumentType("other");
    setDocumentVisibility(DEFAULT_DOCUMENT_VISIBILITY);
    setMessage("המסמך נשמר במאגר.");
    const refreshed = await refresh();
    if (refreshed.error) {
      setMessage(`המסמך נשמר, אך טעינת הרשימה נכשלה: ${refreshed.error}`);
    }
  }

  async function handleVisibilityChange(
    document: DocumentRecord,
    nextVisibility: DocumentVisibility
  ) {
    if (document.visibility === nextVisibility) return;

    if (nextVisibility === "client") {
      const confirmed = window.confirm("האם לאפשר ללקוח לצפות במסמך זה?");
      if (!confirmed) return;
    }

    setActionId(document.id);
    setMessage(null);

    const { document: updated, error } = await updateDocumentVisibility(
      document.id,
      nextVisibility
    );
    setActionId(null);

    if (!updated || error) {
      setMessage(error ?? "עדכון ההרשאה נכשל.");
      return;
    }

    setDocuments((current) =>
      current.map((row) => (row.id === updated.id ? updated : row))
    );
    setMessage(
      nextVisibility === "client"
        ? `המסמך "${updated.title}" גלוי כעת ללקוח.`
        : `המסמך "${updated.title}" הוגדר כפנימי בלבד.`
    );
  }

  async function handleDelete(documentId: string) {
    if (!window.confirm("למחוק את המסמך מהמאגר?")) return;

    setActionId(documentId);
    setMessage(null);
    const ok = await deleteDocument(documentId);
    setActionId(null);
    if (!ok) {
      setMessage("מחיקת המסמך נכשלה.");
      return;
    }
    setMessage("המסמך נמחק מהמאגר.");
    await refresh();
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-gold/30 p-4 space-y-2">
        <h2 className="text-base font-bold text-navy">Document Center — מאגר מסמכים</h2>
        <p className="text-sm text-gray-text">
          מאגר מרכזי לשיוך מסמכים לבניין/מעלית, סוג, תגיות וחיפוש.
          תשתית מוכנה ל-OCR ו-AI בעתיד — ללא OCR/AI ב-V1.
        </p>
        {!cloudReady && (
          <p className="text-sm text-red-600">
            Supabase לא מוגדר. הריצו migration 008 ב-SQL Editor.
          </p>
        )}
        {message && (
          <p className="text-sm font-semibold text-navy bg-gray-light rounded-lg px-3 py-2">
            {message}
          </p>
        )}
      </div>

      <form
        onSubmit={(e) => void handleCreate(e)}
        className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3"
      >
        <h3 className="text-sm font-bold text-navy">הוספת מסמך</h3>

        <MasterExistingBuildingSearch
          entries={buildingOptions}
          resolveElevatorCount={resolveElevatorCount}
          selectedHit={selectedBuildingHit}
          onSelectHit={(hit) => {
            setSelectedBuildingHit(hit);
            setElevatorId("");
          }}
          mode="select"
        />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {selectedBuildingHit && (
            <div className="sm:col-span-2 lg:col-span-3 xl:col-span-4">
              <label className="text-xs text-gray-text">מעלית (אופציונלי)</label>
              {elevatorOptions.length > 0 ? (
                <select
                  value={elevatorId}
                  onChange={(e) => setElevatorId(e.target.value)}
                  className="form-input mt-1"
                >
                  <option value="">כל הבניין</option>
                  {elevatorOptions.map((elevator) => (
                    <option key={elevator.id} value={elevator.id}>
                      {elevator.name}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="text-sm text-gray-text mt-1 rounded-xl border border-gray-100 bg-gray-50 px-3 py-2">
                  אין מעליות רשומות לבניין זה — המסמך יישמר עבור כל הבניין.
                </p>
              )}
            </div>
          )}
          <div>
            <label className="text-xs text-gray-text">סוג מסמך</label>
            <select
              value={documentType}
              onChange={(e) => setDocumentType(e.target.value as DocumentTypeId)}
              className="form-input mt-1"
            >
              {DOCUMENT_TYPES.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>
          {documentType === "inspector_report" ? (
            <InspectorCreateFields
              reportDate={reportDate}
              inspectorName={inspectorName}
              hasRemarks={hasRemarks}
              onReportDateChange={setReportDate}
              onInspectorNameChange={setInspectorName}
              onHasRemarksChange={setHasRemarks}
            />
          ) : (
            <div className="sm:col-span-2 lg:col-span-3 xl:col-span-4 rounded-xl border border-gray-100 bg-gray-50 p-3 space-y-2">
              <p className="text-xs font-semibold text-navy">
                האם לאפשר צפייה ללקוח?
              </p>
              <div className="flex flex-wrap gap-4 text-sm text-navy">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="documentVisibility"
                    value="internal"
                    checked={documentVisibility === "internal"}
                    onChange={() => setDocumentVisibility("internal")}
                  />
                  <span>פנימי בלבד</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="documentVisibility"
                    value="client"
                    checked={documentVisibility === "client"}
                    onChange={() => setDocumentVisibility("client")}
                  />
                  <span>גלוי ללקוח</span>
                </label>
              </div>
              <p className="text-[11px] text-gray-text">
                ברירת מחדל: פנימי בלבד. ההחלטה לכל מסמך בנפרד.
              </p>
            </div>
          )}
          <div>
            <label className="text-xs text-gray-text">כותרת</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="form-input mt-1"
              placeholder="שם המסמך (או ימולא אוטומטית משם הקובץ)"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs text-gray-text">תיאור (אופציונלי)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="form-input mt-1 min-h-[4rem]"
              placeholder="תיאור קצר"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs text-gray-text">תגיות</label>
            <div className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
              {DOCUMENT_PREDEFINED_TAGS.map((tag) => {
                const checked = selectedTags.includes(tag);
                return (
                  <label
                    key={tag}
                    className="flex items-center gap-2 text-xs text-navy cursor-pointer rounded-lg border border-gray-100 px-2 py-1.5 hover:bg-gray-50"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => {
                        setSelectedTags((current) =>
                          checked
                            ? current.filter((value) => value !== tag)
                            : normalizePredefinedDocumentTags([...current, tag])
                        );
                      }}
                      className="rounded border-gray-300 text-navy focus:ring-navy/30"
                    />
                    <span>{tag}</span>
                  </label>
                );
              })}
            </div>
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs text-gray-text">קובץ</label>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <label className="text-xs font-semibold text-navy border border-gray-200 rounded-lg px-3 py-2 hover:bg-gray-50 cursor-pointer">
                בחר קובץ
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.docx,.xlsx,application/pdf,image/jpeg,image/png,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  onChange={handleFileChange}
                  className="sr-only"
                />
              </label>
              {selectedFile && (
                <span className="text-xs text-gray-text break-all">
                  {selectedFile.name} ({Math.round(selectedFile.size / 1024)}KB)
                </span>
              )}
            </div>
            <p className="text-[11px] text-gray-text mt-1">
              PDF · JPG · PNG · DOCX · XLSX · עד {DOCUMENT_CENTER_MAX_FILE_MB}MB
            </p>
            {uploadProgress !== null && (
              <div className="mt-2">
                <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                  <div
                    className="h-full bg-navy transition-all duration-200"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
                <p className="text-[11px] text-gray-text mt-1">
                  מעלה קובץ… {uploadProgress}%
                </p>
              </div>
            )}
          </div>
        </div>

        <button
          type="submit"
          disabled={!cloudReady || creating || !selectedBuildingHit}
          className="btn-primary w-full sm:w-auto disabled:opacity-50"
        >
          {creating
            ? uploadProgress !== null
              ? `מעלה קובץ… ${uploadProgress}%`
              : "שומר..."
            : "שמור במאגר"}
        </button>
        {!selectedBuildingHit && cloudReady && (
          <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            יש לבחור בניין מהרשימה למעלה לפני שמירה (לחיצה על התוצאה או Enter).
          </p>
        )}
      </form>

      <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-navy">
            מאגר מסמכים ({filteredDocuments.length})
          </h3>
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={!cloudReady || loading}
            className="text-xs font-semibold text-navy border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 disabled:opacity-50"
          >
            {loading ? "טוען..." : "רענון"}
          </button>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="חיפוש..."
            className="form-input"
          />
          <select
            value={filterBuildingId}
            onChange={(e) => setFilterBuildingId(e.target.value)}
            className="form-input"
          >
            <option value="">כל הבניינים</option>
            {buildingOptions.map((building) => (
              <option key={building.buildingId} value={building.buildingId}>
                {building.name}
              </option>
            ))}
          </select>
          <select
            value={filterDocumentType}
            onChange={(e) =>
              setFilterDocumentType(e.target.value as DocumentTypeId | "")
            }
            className="form-input"
          >
            <option value="">כל הסוגים</option>
            {DOCUMENT_TYPES.map((type) => (
              <option key={type.id} value={type.id}>
                {type.label}
              </option>
            ))}
          </select>
          <select
            value={filterTag}
            onChange={(e) => setFilterTag(e.target.value)}
            className="form-input"
          >
            <option value="">כל התגיות</option>
            {DOCUMENT_PREDEFINED_TAGS.map((tag) => (
              <option key={tag} value={tag}>
                {tag}
              </option>
            ))}
            {legacyFilterTags.map((tag) => (
              <option key={`legacy-${tag}`} value={tag}>
                {tag} (ישן)
              </option>
            ))}
          </select>
        </div>

        {filteredDocuments.length === 0 ? (
          <p className="text-sm text-gray-text">
            {listError
              ? `טעינת המאגר נכשלה: ${listError}`
              : cloudReady
                ? "אין מסמכים במאגר."
                : "Supabase לא מחובר."}
          </p>
        ) : (
          <div className="space-y-3">
            {filteredDocuments.map((document) => {
              const inspectorMeta =
                document.document_type === "inspector_report"
                  ? inspectorMetaByDocumentId[document.id]
                  : undefined;

              return (
              <article
                key={document.id}
                className="rounded-xl border border-gray-200 p-3 space-y-2"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-bold text-navy">{document.title}</p>
                    <p className="text-xs text-gray-text mt-0.5">
                      {resolveBuildingName(document.building_id)}
                      {document.elevator_id ? ` · ${document.elevator_id}` : ""}
                      {" · "}
                      {getDocumentTypeLabel(document.document_type)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={visibilityBadgeClass(document.visibility)}>
                      {getDocumentVisibilityLabel(document.visibility)}
                    </span>
                    <span className="text-xs font-semibold rounded-full px-2.5 py-1 border bg-gray-50 text-gray-text border-gray-200">
                      {formatDocumentDate(document.created_at)}
                    </span>
                  </div>
                </div>

                {document.description && (
                  <p className="text-xs text-navy/80">{document.description}</p>
                )}

                {document.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {document.tags.map((tag) => (
                      <span
                        key={tag}
                        className="text-[11px] font-medium rounded-full px-2 py-0.5 bg-blue-50 text-blue-800 border border-blue-100"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                <p className="text-[11px] text-gray-text">
                  {document.file_name}
                  {document.file_size_bytes
                    ? ` · ${Math.round(document.file_size_bytes / 1024)}KB`
                    : ""}
                  {" · OCR: "}
                  {document.ocr_status}
                </p>

                <div className="flex flex-wrap gap-2">
                  <a
                    href={document.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-semibold text-navy border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50"
                  >
                    פתח מסמך
                  </a>
                  <button
                    type="button"
                    onClick={() =>
                      void handleVisibilityChange(
                        document,
                        document.visibility === "client" ? "internal" : "client"
                      )
                    }
                    disabled={actionId === document.id}
                    className="text-xs font-semibold text-navy border border-gold/40 rounded-lg px-3 py-1.5 hover:bg-gold/10 disabled:opacity-50"
                  >
                    {document.visibility === "client"
                      ? "הפוך לפנימי"
                      : "שנה הרשאה — גלוי ללקוח"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDelete(document.id)}
                    disabled={actionId === document.id}
                    className="text-xs font-semibold text-red-700 border border-red-200 rounded-lg px-3 py-1.5 hover:bg-red-50 disabled:opacity-50"
                  >
                    מחק מסמך
                  </button>
                </div>

                {inspectorMeta && (
                  <InspectorDocumentCard
                    document={document}
                    meta={inspectorMeta}
                    notifications={
                      inspectorNotificationsByDocumentId[document.id] ?? []
                    }
                    buildingName={resolveBuildingName(document.building_id)}
                    actionId={actionId}
                    onClosed={(msg) => {
                      setMessage(msg);
                      void refresh();
                    }}
                    onActionStart={setActionId}
                    onActionEnd={() => setActionId(null)}
                  />
                )}
              </article>
            );
            })}
          </div>
        )}

        {availableTags.length > 0 && (
          <p className="text-[11px] text-gray-text">
            תגיות במאגר: {formatDocumentTags(availableTags)}
          </p>
        )}
      </div>
    </div>
  );
}
