"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAppVersion } from "@/components/AppVersionProvider";
import {
  MasterProjectV2SecondaryButton,
  MasterProjectV2StatusBanner,
} from "@/components/master-v2/project-v2/MasterProjectV2Workspace";
import {
  confirmDocumentVisibilityChange,
  ProjectDocumentVisibilityBadge,
  ProjectDocumentVisibilityToggle,
  ProjectDocumentVisibilityUploadField,
} from "@/components/master-v2/project-v2/ProjectDocumentVisibility";
import { listMasterInspectorReports } from "@/lib/master-inspector-reports-api";
import {
  DEFAULT_DOCUMENT_VISIBILITY,
  getDocumentTypeLabel,
  getDocumentUploadVisibilityHint,
  getDocumentVisibilityChangeMessage,
  type DocumentRecord,
  type DocumentVisibility,
} from "@/lib/document-center";
import {
  deleteMasterDocument,
  listMasterDocumentsByBuilding,
  updateMasterDocumentVisibility,
  uploadMasterDocument,
} from "@/lib/master-documents-api";
import {
  buildProjectV2AdditionalInspectionUploadTags,
  buildProjectV2UploadTags,
  filterAdditionalInspectionDocuments,
  filterDocumentsForProjectV2Section,
  PROJECT_V2_SECTION_UPLOAD_DEFAULTS,
  type ProjectV2DocumentSection,
} from "@/lib/project-v2-document-sections";
import { isPilotCloudConfigured } from "@/lib/pilot-cloud";

function formatDocumentDate(iso: string): string {
  return new Intl.DateTimeFormat("he-IL", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}

interface ProjectDocumentsPanelProps {
  buildingId: string;
  section: ProjectV2DocumentSection;
  title?: string;
  compact?: boolean;
  /** Excludes primary inspector reports; uploads as supplementary docs only. */
  additionalInspectionOnly?: boolean;
  uploadButtonLabel?: string;
  emptyMessage?: string;
  /** Scoped inspector meta document ids — avoids global meta reads in V2. */
  inspectorMetaDocumentIds?: readonly string[];
}

export default function ProjectDocumentsPanel({
  buildingId,
  section,
  title = "מסמכים",
  compact = true,
  additionalInspectionOnly = false,
  uploadButtonLabel,
  emptyMessage,
  inspectorMetaDocumentIds: inspectorMetaDocumentIdsProp,
}: ProjectDocumentsPanelProps) {
  const { guardSensitiveAction } = useAppVersion();
  const cloudReady = isPilotCloudConfigured();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const sectionDefaults = PROJECT_V2_SECTION_UPLOAD_DEFAULTS[section];

  const [allDocuments, setAllDocuments] = useState<DocumentRecord[]>([]);
  const [inspectorMetaIds, setInspectorMetaIds] = useState<Set<string>>(
    new Set()
  );
  const [loading, setLoading] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [docTitle, setDocTitle] = useState("");
  const [documentVisibility, setDocumentVisibility] =
    useState<DocumentVisibility>(DEFAULT_DOCUMENT_VISIBILITY);
  const [creating, setCreating] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!cloudReady || !buildingId.trim()) {
      setAllDocuments([]);
      return;
    }

    setLoading(true);
    setError(null);
    const listDocuments = await listMasterDocumentsByBuilding(buildingId);

    let metaIds: string[] = [];
    if (inspectorMetaDocumentIdsProp !== undefined) {
      metaIds = [...inspectorMetaDocumentIdsProp];
    } else if (section === "inspections" || additionalInspectionOnly) {
      const inspectorList = await listMasterInspectorReports(buildingId);
      metaIds = inspectorList.inspectorMetaDocumentIds;
    }

    setLoading(false);

    setInspectorMetaIds(new Set(metaIds));
    setAllDocuments(listDocuments);
  }, [
    buildingId,
    cloudReady,
    section,
    additionalInspectionOnly,
    inspectorMetaDocumentIdsProp,
  ]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const sectionDocuments = useMemo(() => {
    if (additionalInspectionOnly) {
      return filterAdditionalInspectionDocuments(
        allDocuments,
        buildingId,
        inspectorMetaIds
      );
    }
    return filterDocumentsForProjectV2Section(
      allDocuments,
      buildingId,
      section,
      inspectorMetaIds
    );
  }, [
    allDocuments,
    buildingId,
    section,
    inspectorMetaIds,
    additionalInspectionOnly,
  ]);

  const uploadDocumentType = additionalInspectionOnly
    ? ("correspondence" as const)
    : sectionDefaults.documentType;
  const uploadTags = additionalInspectionOnly
    ? buildProjectV2AdditionalInspectionUploadTags()
    : buildProjectV2UploadTags(section);
  const uploadDescription = additionalInspectionOnly
    ? "מסמך בדיקה נוסף (אישור, התכתבות וכו׳ — לא תסקיר בודק)"
    : sectionDefaults.description;

  async function handleUploadSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!guardSensitiveAction()) return;
    if (!selectedFile || !cloudReady) return;

    setCreating(true);
    setMessage(null);
    setError(null);

    const { document: created, error: uploadError } = await uploadMasterDocument(
      {
        buildingId,
        documentType: uploadDocumentType,
        title: docTitle.trim() || selectedFile.name,
        file: selectedFile,
        tags: uploadTags,
        visibility: documentVisibility,
      },
      setUploadProgress
    );

    setCreating(false);
    setUploadProgress(null);

    if (!created) {
      setError(uploadError ?? "שמירת המסמך נכשלה.");
      return;
    }

    setSelectedFile(null);
    setDocTitle("");
    setDocumentVisibility(DEFAULT_DOCUMENT_VISIBILITY);
    setUploadOpen(false);
    const uploadHint = getDocumentUploadVisibilityHint(created.visibility);
    setMessage(
      uploadHint ? `המסמך נשמר. ${uploadHint}` : "המסמך נשמר."
    );
    await refresh();
  }

  async function handleVisibilityChange(
    document: DocumentRecord,
    nextVisibility: DocumentVisibility
  ) {
    if (document.visibility === nextVisibility) return;
    if (!guardSensitiveAction()) return;

    const confirmed = await confirmDocumentVisibilityChange(nextVisibility);
    if (!confirmed) return;

    setActionId(document.id);
    setMessage(null);
    setError(null);

    const { document: updated, error: updateError } =
      await updateMasterDocumentVisibility(
        buildingId,
        document.id,
        nextVisibility
      );
    setActionId(null);

    if (!updated || updateError) {
      setError(updateError ?? "עדכון ההרשאה נכשל.");
      return;
    }

    setAllDocuments((current) =>
      current.map((row) => (row.id === updated.id ? updated : row))
    );
    setMessage(getDocumentVisibilityChangeMessage(nextVisibility));
  }

  async function handleDelete(documentId: string) {
    if (!window.confirm("למחוק את המסמך?")) return;
    if (!guardSensitiveAction()) return;

    setActionId(documentId);
    setMessage(null);
    setError(null);
    const { ok, error: deleteError } = await deleteMasterDocument(
      buildingId,
      documentId
    );
    setActionId(null);

    if (!ok) {
      setError(deleteError ?? "מחיקת המסמך נכשלה.");
      return;
    }

    setMessage("המסמך נמחק.");
    await refresh();
  }

  function resetUploadDialog() {
    setUploadOpen(false);
    setSelectedFile(null);
    setDocTitle("");
    setDocumentVisibility(DEFAULT_DOCUMENT_VISIBILITY);
    setUploadProgress(null);
  }

  return (
    <section
      className={`border-t border-forte-border/60 ${compact ? "pt-4 mt-4" : "pt-6 mt-6"}`}
      data-project-documents-section={section}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div>
          <h3 className="text-xs font-bold text-forte-text">{title}</h3>
          {!compact && (
            <p className="text-[11px] text-forte-text-secondary mt-0.5">
              {sectionDefaults.description}
            </p>
          )}
        </div>
        {cloudReady && (
          <MasterProjectV2SecondaryButton onClick={() => setUploadOpen(true)}>
            {uploadButtonLabel ?? "העלאת מסמך"}
          </MasterProjectV2SecondaryButton>
        )}
      </div>

      {!cloudReady && (
        <MasterProjectV2StatusBanner tone="warning">
          Supabase לא מוגדר — לא ניתן לטעון מסמכים.
        </MasterProjectV2StatusBanner>
      )}

      {message && (
        <MasterProjectV2StatusBanner tone="success">{message}</MasterProjectV2StatusBanner>
      )}
      {error && (
        <MasterProjectV2StatusBanner tone="error">{error}</MasterProjectV2StatusBanner>
      )}

      {loading ? (
        <p className="text-xs text-forte-text-secondary py-4 text-center">טוען מסמכים...</p>
      ) : sectionDocuments.length === 0 ? (
        <p className="text-xs text-forte-text-secondary py-3">
          {emptyMessage ?? "אין מסמכים באזור זה. ניתן להעלות מסמך חדש."}
        </p>
      ) : (
        <div className="fv2-table-scroll overflow-x-auto rounded-md border border-forte-border bg-white">
          <table className="fv2-data-table w-full text-xs text-right">
            <thead className="bg-forte-blue-light/40 text-forte-text-secondary">
              <tr>
                <th className="px-3 py-2 font-medium">שם</th>
                <th className="px-3 py-2 font-medium">סוג</th>
                <th className="px-3 py-2 font-medium">הרשאה</th>
                <th className="px-3 py-2 font-medium">תאריך</th>
                <th className="px-3 py-2 font-medium w-28">פעולות</th>
              </tr>
            </thead>
            <tbody>
              {sectionDocuments.map((document) => (
                <tr key={document.id} className="border-t border-forte-border/60">
                  <td className="px-3 py-2 font-medium text-forte-text fv2-card-primary" data-label="שם">
                    {document.title}
                  </td>
                  <td className="px-3 py-2 text-forte-text-secondary" data-label="סוג">
                    {getDocumentTypeLabel(document.document_type)}
                  </td>
                  <td className="px-3 py-2" data-label="הרשאה">
                    <div className="flex flex-col items-start gap-1">
                      <ProjectDocumentVisibilityBadge
                        visibility={document.visibility}
                      />
                      <ProjectDocumentVisibilityToggle
                        document={document}
                        disabled={actionId === document.id}
                        onToggle={(doc, next) =>
                          void handleVisibilityChange(doc, next)
                        }
                      />
                    </div>
                  </td>
                  <td className="px-3 py-2 text-forte-text-secondary whitespace-nowrap" data-label="תאריך">
                    {formatDocumentDate(document.created_at)}
                  </td>
                  <td className="px-3 py-2" data-label="פעולות">
                    <div className="flex flex-wrap gap-2 justify-end">
                      <a
                        href={document.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-forte-text hover:underline"
                      >
                        פתיחה
                      </a>
                      <button
                        type="button"
                        disabled={actionId === document.id}
                        onClick={() => void handleDelete(document.id)}
                        className="text-red-600 hover:underline disabled:opacity-40"
                      >
                        מחיקה
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {uploadOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-forte-text/30 p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-labelledby="project-documents-upload-title"
        >
          <form
            onSubmit={(event) => void handleUploadSubmit(event)}
            className="w-full max-w-md bg-white rounded-lg border border-forte-border shadow-xl p-4 space-y-3 max-h-[92dvh] overflow-y-auto"
          >
            <h4
              id="project-documents-upload-title"
              className="text-sm font-bold text-forte-text"
            >
              העלאת מסמך — {uploadDescription}
            </h4>
            {additionalInspectionOnly && (
              <p className="text-[11px] text-amber-900 bg-amber-50 border border-amber-200 rounded-md px-2 py-1.5">
                תסקיר בודק מלא מועלה דרך «+ תסקיר בודק» בלבד.
              </p>
            )}
            <p className="text-[11px] text-forte-text-secondary">
              המסמך יישמר אוטומטית לפרויקט{" "}
              <span dir="ltr" className="font-mono">
                {buildingId}
              </span>
            </p>
            <label className="block space-y-1">
              <span className="text-xs text-forte-text-secondary">קובץ</span>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xlsx"
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null;
                  setSelectedFile(file);
                  if (file && !docTitle.trim()) {
                    setDocTitle(file.name.replace(/\.[^.]+$/, ""));
                  }
                }}
                className="block w-full text-xs"
                required
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs text-forte-text-secondary">שם / כותרת</span>
              <input
                value={docTitle}
                onChange={(event) => setDocTitle(event.target.value)}
                className="form-input text-sm py-2"
                placeholder="שם המסמך"
              />
            </label>
            <ProjectDocumentVisibilityUploadField
              value={documentVisibility}
              onChange={setDocumentVisibility}
            />
            {uploadProgress != null && uploadProgress < 100 && (
              <p className="text-[11px] text-forte-text-secondary">
                מעלה... {uploadProgress}%
              </p>
            )}
            <div className="flex gap-2 pt-1">
              <button
                type="submit"
                disabled={creating || !selectedFile}
                className="flex-1 rounded-md bg-forte-primary text-white py-2 text-xs font-semibold disabled:opacity-40"
              >
                {creating ? "שומר..." : "שמור"}
              </button>
              <MasterProjectV2SecondaryButton onClick={resetUploadDialog}>
                ביטול
              </MasterProjectV2SecondaryButton>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
