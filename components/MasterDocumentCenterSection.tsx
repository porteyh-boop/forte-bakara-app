"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  collectDocumentTags,
  createDocument,
  deleteDocument,
  deleteDocumentCenterStorageFile,
  DOCUMENT_TYPES,
  filterDocuments,
  formatDocumentDate,
  formatDocumentTags,
  getAllDocuments,
  getDocumentTypeLabel,
  isDocumentCenterConfigured,
  parseDocumentTagsInput,
  resolveDocumentContentType,
  uploadDocumentCenterFile,
  validateDocumentCenterFile,
  validateCreateDocumentInput,
  type DocumentRecord,
  type DocumentTypeId,
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
import { buildMasterBuildingList } from "@/lib/master-buildings-list";
import { getAllBuildingIds, getBuildingDataset } from "@/lib/buildings";

function resolveBuildingName(buildingId: string): string {
  try {
    return getBuildingDataset(buildingId).building.name;
  } catch {
    return buildingId;
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

  const [buildingId, setBuildingId] = useState(() => getAllBuildingIds()[0] ?? "");
  const [elevatorId, setElevatorId] = useState("");
  const [documentType, setDocumentType] = useState<DocumentTypeId>("other");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tagsInput, setTagsInput] = useState("");
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

  const buildingOptions = useMemo(
    () =>
      buildMasterBuildingList({
        cloudBuildings: [],
        demoBuildingIds: getAllBuildingIds(),
        resolveDemoName: (id) => getBuildingDataset(id).building.name,
        resolveDemoCity: (id) => getBuildingDataset(id).building.city,
        faultBuildings: [],
      }),
    []
  );

  const elevatorOptions = useMemo(() => {
    if (!buildingId) return [];
    try {
      return getBuildingDataset(buildingId).elevators.map((elevator) => ({
        id: elevator.id,
        name: elevator.name,
      }));
    } catch {
      return [];
    }
  }, [buildingId]);

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
      setTagsInput("");
      setElevatorId("");
      setInspectorName("");
      setHasRemarks(false);
      setSelectedFile(null);
      setDocumentType("other");
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

    setCreating(true);
    const uploaded = await uploadDocumentCenterFile(
      selectedFile,
      buildingId,
      setUploadProgress
    );

    if (!uploaded.ok) {
      setCreating(false);
      setUploadProgress(null);
      setMessage(
        uploaded.stage === "validation"
          ? uploaded.error
          : uploaded.details
            ? `העלאת הקובץ נכשלה: ${uploaded.details}`
            : "העלאת הקובץ נכשלה"
      );
      return;
    }

    const input = {
      buildingId,
      elevatorId: elevatorId || null,
      documentType,
      title: title || selectedFile.name,
      description,
      fileName: selectedFile.name,
      fileUrl: uploaded.fileUrl,
      storagePath: uploaded.storagePath,
      mimeType: resolveDocumentContentType(selectedFile.name, selectedFile.type),
      fileSizeBytes: selectedFile.size,
      tags: parseDocumentTagsInput(tagsInput),
    };

    const validationError = validateCreateDocumentInput(input);
    if (validationError) {
      setCreating(false);
      setUploadProgress(null);
      setMessage(validationError);
      return;
    }

    const { document: created, error: insertError } = await createDocument(input);
    setCreating(false);
    setUploadProgress(null);

    if (!created) {
      await deleteDocumentCenterStorageFile(uploaded.storagePath);
      setMessage(
        insertError
          ? `שמירת המסמך נכשלה: ${insertError}`
          : "שמירת המסמך נכשלה."
      );
      console.error("[document-center] save failed after upload:", insertError);
      return;
    }

    setTitle("");
    setDescription("");
    setTagsInput("");
    setElevatorId("");
    setSelectedFile(null);
    setDocumentType("other");
    setMessage("המסמך נשמר במאגר.");
    const refreshed = await refresh();
    if (refreshed.error) {
      setMessage(`המסמך נשמר, אך טעינת הרשימה נכשלה: ${refreshed.error}`);
    }
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
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="text-xs text-gray-text">בניין</label>
            <select
              value={buildingId}
              onChange={(e) => {
                setBuildingId(e.target.value);
                setElevatorId("");
              }}
              className="form-input mt-1"
              required
            >
              {buildingOptions.map((building) => (
                <option key={building.buildingId} value={building.buildingId}>
                  {building.name} ({building.buildingId})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-text">מעלית (אופציונלי)</label>
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
          </div>
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
          ) : null}
          <div>
            <label className="text-xs text-gray-text">כותרת</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="form-input mt-1"
              placeholder="שם המסמך"
              required
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
            <label className="text-xs text-gray-text">תגיות (מופרדות בפסיק)</label>
            <input
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              className="form-input mt-1"
              placeholder="בודק, שנתי, דחוף"
            />
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
              PDF · JPG · PNG · DOCX · XLSX · עד 20MB
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
          disabled={!cloudReady || creating}
          className="btn-primary w-full sm:w-auto disabled:opacity-50"
        >
          {creating
            ? uploadProgress !== null
              ? `מעלה קובץ… ${uploadProgress}%`
              : "שומר..."
            : "שמור במאגר"}
        </button>
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
            {availableTags.map((tag) => (
              <option key={tag} value={tag}>
                {tag}
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
                  <span className="text-xs font-semibold rounded-full px-2.5 py-1 border bg-gray-50 text-gray-text border-gray-200">
                    {formatDocumentDate(document.created_at)}
                  </span>
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
