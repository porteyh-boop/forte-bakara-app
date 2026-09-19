"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ForteV2Dialog,
  ForteV2DialogOverlay,
  ForteV2Panel,
  ForteV2TabShell,
  MasterProjectV2EmptyState,
  MasterProjectV2PrimaryButton,
  MasterProjectV2SecondaryButton,
  MasterProjectV2StatusBanner,
} from "@/components/master-v2/project-v2/MasterProjectV2Workspace";
import {
  CLIENT_UPDATE_STATUSES,
  CLIENT_UPDATE_TYPES,
  type ClientUpdateStatusId,
  type ClientUpdateTypeId,
  type MasterBuildingClientUpdateDto,
} from "@/lib/building-client-updates";
import type { ClientUserAccessListItem } from "@/lib/client-access";
import {
  buildClientUpdatePortalUrl,
  buildClientUpdateShareMessage,
  buildClientUpdateWhatsAppUrl,
  normalizeIsraeliPhoneForWhatsApp,
} from "@/lib/client-portal-update-share";
import {
  createMasterBuildingClientUpdate,
  listMasterBuildingClientUpdates,
  patchMasterBuildingClientUpdate,
} from "@/lib/master-building-client-updates-api";
import {
  getMasterClientPermissionsOrDefaults,
  listMasterClientAccessRecords,
} from "@/lib/master-client-access-api";
import { buildMasterProjectV2Path } from "@/lib/master-project-v2-routes";
import {
  listMasterDocumentsByBuilding,
  uploadMasterDocument,
} from "@/lib/master-documents-api";
import {
  isProjectContactsConfigured,
  listProjectContacts,
} from "@/lib/project-contacts-cloud";
import type { ProjectContactWithDetails } from "@/lib/contacts";
import { getBuildingDataset } from "@/lib/buildings";

type EditorMode = "create" | "edit";
type ShareBlockReason = "no_portal" | "no_permission";

function formatUpdateDateTime(iso: string): string {
  return new Intl.DateTimeFormat("he-IL", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function emptyDraft(): {
  title: string;
  body: string;
  updateType: ClientUpdateTypeId;
  status: ClientUpdateStatusId;
  visibleToClient: boolean;
  documentId: string;
} {
  return {
    title: "",
    body: "",
    updateType: CLIENT_UPDATE_TYPES[0].id,
    status: CLIENT_UPDATE_STATUSES[2].id,
    visibleToClient: false,
    documentId: "",
  };
}

interface MasterProjectV2ClientUpdatesTabProps {
  buildingId: string;
}

export default function MasterProjectV2ClientUpdatesTab({
  buildingId,
}: MasterProjectV2ClientUpdatesTabProps) {
  const router = useRouter();
  const [updates, setUpdates] = useState<MasterBuildingClientUpdateDto[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<EditorMode>("create");
  const [editing, setEditing] = useState<MasterBuildingClientUpdateDto | null>(
    null
  );
  const [draft, setDraft] = useState(emptyDraft);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [clientDocs, setClientDocs] = useState<
    { id: string; title: string }[]
  >([]);
  const [accessRecords, setAccessRecords] = useState<ClientUserAccessListItem[]>(
    []
  );
  const [contacts, setContacts] = useState<ProjectContactWithDetails[]>([]);
  const [shareRecipientKey, setShareRecipientKey] = useState<string>("");
  const [copyHint, setCopyHint] = useState<string | null>(null);
  const [shareBlockDialog, setShareBlockDialog] =
    useState<ShareBlockReason | null>(null);

  const buildingLabel = useMemo(() => {
    const ds = getBuildingDataset(buildingId);
    const name = ds?.building?.name?.trim();
    const city = ds?.building?.city?.trim();
    if (name && city) return `${name}, ${city}`;
    return name || city || buildingId;
  }, [buildingId]);

  const refresh = useCallback(async () => {
    setLoading(true);
    const result = await listMasterBuildingClientUpdates(buildingId);
    setUpdates(result.updates);
    setLoadError(result.error);
    setLoading(false);
  }, [buildingId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    void listMasterDocumentsByBuilding(buildingId).then((docs) => {
      setClientDocs(
        docs
          .filter((d) => d.visibility === "client")
          .map((d) => ({ id: d.id, title: d.title }))
      );
    });
    void listMasterClientAccessRecords(buildingId).then(setAccessRecords);
    if (isProjectContactsConfigured()) {
      void listProjectContacts(buildingId).then((r) => setContacts(r.contacts));
    }
  }, [buildingId]);

  const shareRecipients = useMemo(() => {
    const primary = contacts.find((c) => c.isPrimary && c.phone?.trim());
    const options: { key: string; name: string; phone: string }[] = [];

    if (primary?.phone?.trim()) {
      options.push({
        key: `contact:${primary.id}`,
        name: primary.fullName,
        phone: primary.phone.trim(),
      });
    }

    for (const item of accessRecords) {
      const phone = item.user.phone?.trim();
      if (!phone) continue;
      const key = `user:${item.user.id}`;
      if (options.some((o) => o.key === key)) continue;
      options.push({
        key,
        name: item.user.name,
        phone,
      });
    }

    for (const c of contacts) {
      if (c.isPrimary) continue;
      const phone = c.phone?.trim();
      if (!phone) continue;
      const key = `contact:${c.id}`;
      if (options.some((o) => o.key === key)) continue;
      options.push({ key, name: c.fullName, phone });
    }

    return options;
  }, [accessRecords, contacts]);

  useEffect(() => {
    if (shareRecipients.length === 0) {
      setShareRecipientKey("");
      return;
    }
    if (
      shareRecipientKey &&
      shareRecipients.some((r) => r.key === shareRecipientKey)
    ) {
      return;
    }
    setShareRecipientKey(shareRecipients[0].key);
  }, [shareRecipients, shareRecipientKey]);

  /** User whose access token is embedded in the shared portal / WhatsApp link. */
  const portalLinkAccess = useMemo(
    () =>
      accessRecords.find(
        (r) => r.user.is_active && r.user.access_token?.trim()
      ) ?? null,
    [accessRecords]
  );

  const activePortalUrl = useMemo(() => {
    if (!portalLinkAccess?.user.access_token) return null;
    return buildClientUpdatePortalUrl(portalLinkAccess.user.access_token);
  }, [portalLinkAccess]);

  const goToPermissionsTab = useCallback(() => {
    setShareBlockDialog(null);
    router.replace(buildMasterProjectV2Path(buildingId, "permissions"));
  }, [buildingId, router]);

  const resolveShareGate = useCallback(async (): Promise<
    "ok" | ShareBlockReason
  > => {
    if (!portalLinkAccess?.user.access_token?.trim()) {
      return "no_portal";
    }
    const flags = await getMasterClientPermissionsOrDefaults(
      portalLinkAccess.user.id
    );
    if (!flags.can_view_client_updates) {
      return "no_permission";
    }
    return "ok";
  }, [portalLinkAccess]);

  const runGatedShareAction = useCallback(
    async (action: () => void) => {
      const gate = await resolveShareGate();
      if (gate === "ok") {
        action();
        return;
      }
      setShareBlockDialog(gate);
    },
    [resolveShareGate]
  );

  function openCreate() {
    setEditorMode("create");
    setEditing(null);
    setDraft(emptyDraft());
    setPendingFile(null);
    setFormError(null);
    setDialogOpen(true);
  }

  function openEdit(update: MasterBuildingClientUpdateDto) {
    setEditorMode("edit");
    setEditing(update);
    setDraft({
      title: update.title,
      body: update.body,
      updateType: update.updateType,
      status: update.status,
      visibleToClient: update.visibleToClient,
      documentId: update.documentId ?? "",
    });
    setPendingFile(null);
    setFormError(null);
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    setFormError(null);
    setPendingFile(null);
  }

  function mergeUpdate(updated: MasterBuildingClientUpdateDto) {
    setUpdates((prev) => {
      const idx = prev.findIndex((u) => u.id === updated.id);
      if (idx === -1) return [updated, ...prev];
      const next = [...prev];
      next[idx] = updated;
      return next.sort(
        (a, b) =>
          new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
      );
    });
  }

  async function resolveDocumentId(): Promise<string | null> {
    if (pendingFile) {
      const title =
        pendingFile.name.replace(/\.[^.]+$/, "").trim() || "מסמך מצורף";
      const { document, error } = await uploadMasterDocument({
        buildingId,
        documentType: "other",
        title,
        file: pendingFile,
        visibility: "client",
      });
      if (!document) {
        throw new Error(error ?? "upload_failed");
      }
      return document.id;
    }
    const selected = draft.documentId.trim();
    return selected || null;
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.title.trim() || !draft.body.trim()) {
      setFormError("יש למלא כותרת ותוכן.");
      return;
    }

    setSaving(true);
    setFormError(null);

    try {
      let documentId: string | null = null;
      if (pendingFile || draft.documentId.trim()) {
        documentId = await resolveDocumentId();
      }

      if (editorMode === "create") {
        const result = await createMasterBuildingClientUpdate({
          buildingId,
          title: draft.title.trim(),
          body: draft.body.trim(),
          updateType: draft.updateType,
          status: draft.status,
          visibleToClient: draft.visibleToClient,
          documentId,
        });
        if (!result.update) {
          setFormError(result.error ?? "יצירת העדכון נכשלה.");
          setSaving(false);
          return;
        }
        mergeUpdate(result.update);
      } else if (editing) {
        const result = await patchMasterBuildingClientUpdate(
          buildingId,
          editing.id,
          {
            title: draft.title.trim(),
            body: draft.body.trim(),
            updateType: draft.updateType,
            status: draft.status,
            visibleToClient: draft.visibleToClient,
            documentId,
            clearDocument: !documentId && !draft.documentId.trim(),
          }
        );
        if (!result.update) {
          setFormError(result.error ?? "שמירת העדכון נכשלה.");
          setSaving(false);
          return;
        }
        mergeUpdate(result.update);
      }

      closeDialog();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "שגיאה בשמירה.");
    }

    setSaving(false);
  }

  async function togglePublish(update: MasterBuildingClientUpdateDto) {
    const result = await patchMasterBuildingClientUpdate(buildingId, update.id, {
      visibleToClient: !update.visibleToClient,
    });
    if (result.update) mergeUpdate(result.update);
  }

  async function quickStatusChange(
    update: MasterBuildingClientUpdateDto,
    status: ClientUpdateStatusId
  ) {
    const result = await patchMasterBuildingClientUpdate(buildingId, update.id, {
      status,
    });
    if (result.update) mergeUpdate(result.update);
  }

  function buildShareMessageForUpdate(
    update: MasterBuildingClientUpdateDto,
    recipientName: string
  ): string | null {
    if (!activePortalUrl) return null;
    return buildClientUpdateShareMessage({
      recipientName,
      buildingLabel,
      updateTitle: update.title,
      portalUrl: activePortalUrl,
    });
  }

  function renderReadStatuses(update: MasterBuildingClientUpdateDto) {
    if (update.readBy.length === 0) {
      return (
        <p className="text-xs text-forte-text-secondary mt-2">
          אין נציגי לקוח עם גישה לפורטל בבניין זה.
        </p>
      );
    }

    return (
      <ul className="mt-2 space-y-1 text-xs text-forte-text-secondary">
        {update.readBy.map((row) => (
          <li key={row.clientUserId}>
            נציג ועד: {row.clientUserName} —{" "}
            {row.readAt
              ? `נקרא ${formatUpdateDateTime(row.readAt)}`
              : "טרם נקרא"}
          </li>
        ))}
      </ul>
    );
  }

  function renderShareActions(update: MasterBuildingClientUpdateDto) {
    if (!update.visibleToClient) return null;

    const recipient =
      shareRecipients.find((r) => r.key === shareRecipientKey) ??
      shareRecipients[0];
    const message =
      recipient && activePortalUrl
        ? buildShareMessageForUpdate(update, recipient.name)
        : null;
    const waUrl =
      recipient && message
        ? buildClientUpdateWhatsAppUrl(recipient.phone, message)
        : null;
    const phoneOk = recipient
      ? Boolean(normalizeIsraeliPhoneForWhatsApp(recipient.phone))
      : false;

    return (
      <div className="mt-3 pt-3 border-t border-forte-border/60 space-y-2">
        {shareRecipients.length > 1 ? (
          <label className="block text-xs">
            <span className="font-medium text-forte-text">נמען WhatsApp</span>
            <select
              className="form-input text-xs py-1.5 mt-1 w-full max-w-xs"
              value={shareRecipientKey}
              onChange={(e) => setShareRecipientKey(e.target.value)}
            >
              {shareRecipients.map((r) => (
                <option key={r.key} value={r.key}>
                  {r.name} ({r.phone})
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <div className="flex flex-wrap gap-2">
          {waUrl && phoneOk ? (
            <button
              type="button"
              className="rounded-md bg-[#25D366] px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
              onClick={() => {
                void runGatedShareAction(() => {
                  window.open(waUrl, "_blank", "noopener,noreferrer");
                });
              }}
            >
              שלח WhatsApp
            </button>
          ) : (
            <span
              className="text-xs text-forte-text-secondary"
              title="לא נמצא מספר תקין ל-WhatsApp"
            >
              שלח WhatsApp — {recipient ? "מספר לא תקין" : "אין נמען"}
            </span>
          )}

          <MasterProjectV2SecondaryButton
            disabled={!message}
            onClick={() => {
              if (!message) return;
              void runGatedShareAction(() => {
                void navigator.clipboard.writeText(message).then(() => {
                  setCopyHint("ההודעה הועתקה.");
                  window.setTimeout(() => setCopyHint(null), 2500);
                });
              });
            }}
          >
            העתק הודעה
          </MasterProjectV2SecondaryButton>

          <MasterProjectV2SecondaryButton
            onClick={() => {
              void runGatedShareAction(() => {
                if (!activePortalUrl) return;
                window.open(activePortalUrl, "_blank", "noopener,noreferrer");
              });
            }}
          >
            פתח פורטל
          </MasterProjectV2SecondaryButton>
        </div>
        {!activePortalUrl ? (
          <p className="text-xs text-amber-800">
            אין קישור פעיל לפורטל — צרו גישת לקוח בטאב הרשאות.
          </p>
        ) : null}
        {copyHint ? (
          <p className="text-xs text-green-800">{copyHint}</p>
        ) : null}
      </div>
    );
  }

  return (
    <ForteV2TabShell
      workspace="project-v2-client-updates"
      title="עדכונים ללקוח"
      description="עדכוני פעילות לפרסום בפורטל הלקוח — טיוטה, פרסום ושיתוף ידני"
      actions={
        <MasterProjectV2PrimaryButton onClick={openCreate}>
          + עדכון חדש
        </MasterProjectV2PrimaryButton>
      }
    >
      {loadError ? (
        <MasterProjectV2StatusBanner tone="error">{loadError}</MasterProjectV2StatusBanner>
      ) : null}

      {loading ? (
        <p className="text-sm text-forte-text-secondary py-8 text-center">
          טוען עדכונים...
        </p>
      ) : updates.length === 0 ? (
        <MasterProjectV2EmptyState
          title="אין עדכונים עדיין"
          description="צרו עדכון חדש כדי לשתף את הלקוח בפעילות האחרונה בפרויקט."
          actions={
            <MasterProjectV2PrimaryButton onClick={openCreate}>
              + עדכון חדש
            </MasterProjectV2PrimaryButton>
          }
        />
      ) : (
        <ul className="space-y-3">
          {updates.map((update) => (
            <li key={update.id}>
              <ForteV2Panel className="p-4 sm:p-5">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-forte-text-secondary whitespace-nowrap">
                      {formatUpdateDateTime(update.publishedAt)}
                    </p>
                    <h3 className="text-base font-bold text-forte-text mt-1">
                      {update.title}
                    </h3>
                    <div className="flex flex-wrap gap-2 mt-2 text-xs">
                      <span className="rounded-full bg-forte-blue-light px-2 py-0.5 text-forte-text">
                        {update.updateTypeLabel}
                      </span>
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-forte-text">
                        {update.statusLabel}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 ${
                          update.visibleToClient
                            ? "bg-green-100 text-green-900"
                            : "bg-amber-50 text-amber-900"
                        }`}
                      >
                        {update.visibleToClient
                          ? "פורסם ללקוח"
                          : "טיוטה / לא פורסם ללקוח"}
                      </span>
                    </div>
                    <p className="text-sm text-forte-text/90 mt-3 whitespace-pre-wrap">
                      {update.body}
                    </p>
                    {update.documentId && update.attachmentTitle ? (
                      <p className="text-xs text-forte-text-secondary mt-2">
                        מסמך מצורף: {update.attachmentTitle}
                      </p>
                    ) : null}
                    {renderReadStatuses(update)}
                    {renderShareActions(update)}
                  </div>
                  <div className="flex flex-wrap gap-2 shrink-0">
                    <MasterProjectV2SecondaryButton onClick={() => openEdit(update)}>
                      ערוך
                    </MasterProjectV2SecondaryButton>
                    <MasterProjectV2SecondaryButton
                      onClick={() => void togglePublish(update)}
                    >
                      {update.visibleToClient ? "הסתר מלקוח" : "פרסם ללקוח"}
                    </MasterProjectV2SecondaryButton>
                    <select
                      className="form-input text-xs py-1.5 max-w-[10rem]"
                      value={update.status}
                      onChange={(e) =>
                        void quickStatusChange(
                          update,
                          e.target.value as ClientUpdateStatusId
                        )
                      }
                      aria-label="סטטוס עדכון"
                    >
                      {CLIENT_UPDATE_STATUSES.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </ForteV2Panel>
            </li>
          ))}
        </ul>
      )}

      {dialogOpen ? (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-forte-text/30 p-4 overflow-y-auto">
          <form
            onSubmit={(e) => void handleSave(e)}
            className="w-full max-w-lg bg-white rounded-lg border border-forte-border shadow-xl p-4 space-y-3 max-h-[92dvh] overflow-y-auto mb-[max(0.5rem,env(safe-area-inset-bottom))] sm:mb-0"
          >
            <h4 className="text-sm font-bold text-forte-text">
              {editorMode === "create" ? "עדכון חדש" : "עריכת עדכון"}
            </h4>
            {formError ? (
              <MasterProjectV2StatusBanner tone="error">{formError}</MasterProjectV2StatusBanner>
            ) : null}

            <label className="block space-y-1">
              <span className="text-xs font-medium text-forte-text">כותרת *</span>
              <input
                value={draft.title}
                onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
                className="form-input text-sm py-2"
                required
              />
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block space-y-1">
                <span className="text-xs font-medium text-forte-text">סוג עדכון *</span>
                <select
                  value={draft.updateType}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      updateType: e.target.value as ClientUpdateTypeId,
                    }))
                  }
                  className="form-input text-sm py-2"
                  required
                >
                  {CLIENT_UPDATE_TYPES.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-medium text-forte-text">סטטוס *</span>
                <select
                  value={draft.status}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      status: e.target.value as ClientUpdateStatusId,
                    }))
                  }
                  className="form-input text-sm py-2"
                  required
                >
                  {CLIENT_UPDATE_STATUSES.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="block space-y-1">
              <span className="text-xs font-medium text-forte-text">תוכן *</span>
              <textarea
                value={draft.body}
                onChange={(e) => setDraft((d) => ({ ...d, body: e.target.value }))}
                rows={5}
                className="form-input text-sm py-2 min-h-[100px]"
                required
              />
            </label>

            <label className="block space-y-1">
              <span className="text-xs font-medium text-forte-text">
                מסמך (אופציונלי)
              </span>
              <select
                value={draft.documentId}
                onChange={(e) => {
                  setDraft((d) => ({ ...d, documentId: e.target.value }));
                  if (e.target.value) setPendingFile(null);
                }}
                className="form-input text-sm py-2"
                disabled={Boolean(pendingFile)}
              >
                <option value="">ללא / העלאה חדשה</option>
                {clientDocs.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.title}
                  </option>
                ))}
              </select>
              <input
                type="file"
                className="form-input text-xs py-1.5 mt-1"
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null;
                  setPendingFile(file);
                  if (file) setDraft((d) => ({ ...d, documentId: "" }));
                }}
              />
              <span className="text-[10px] text-forte-text-secondary">
                מסמך חייב להיות visibility=client ושייך לאותו בניין.
              </span>
            </label>

            <label className="flex items-center justify-between gap-3 rounded-md border border-gray-200 px-3 py-2.5">
              <span className="text-xs text-forte-text">גלוי ללקוח (פרסום)</span>
              <button
                type="button"
                role="switch"
                aria-checked={draft.visibleToClient}
                onClick={() =>
                  setDraft((d) => ({
                    ...d,
                    visibleToClient: !d.visibleToClient,
                  }))
                }
                className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${
                  draft.visibleToClient ? "bg-navy" : "bg-gray-300"
                }`}
              >
                <span
                  className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all duration-200 ${
                    draft.visibleToClient ? "end-0.5" : "end-5"
                  }`}
                />
              </button>
            </label>

            <div className="flex gap-2 pt-1">
              <button
                type="submit"
                disabled={saving}
                className="rounded-md bg-forte-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-forte-primary-hover disabled:opacity-40"
              >
                {saving ? "שומר..." : "שמור"}
              </button>
              <MasterProjectV2SecondaryButton type="button" onClick={closeDialog}>
                ביטול
              </MasterProjectV2SecondaryButton>
            </div>
          </form>
        </div>
      ) : null}

      {shareBlockDialog ? (
        <ForteV2DialogOverlay onClose={() => setShareBlockDialog(null)}>
          <ForteV2Dialog
            title={
              shareBlockDialog === "no_portal"
                ? "גישת פורטל חסרה"
                : "הרשאת צפייה חסרה"
            }
            onClose={() => setShareBlockDialog(null)}
            size="md"
          >
            <div className="space-y-4" dir="rtl">
              <p className="text-sm text-forte-text whitespace-pre-line">
                {shareBlockDialog === "no_portal"
                  ? "לא נמצא משתמש פורטל פעיל ללקוח.\nיש להגדיר גישה לפורטל לפני שליחת ההודעה."
                  : "ללקוח אין הרשאה לצפות בעדכונים והודעות.\nיש להפעיל את ההרשאה לפני שליחת ההודעה."}
              </p>
              <div className="flex flex-wrap justify-start gap-2">
                <MasterProjectV2PrimaryButton
                  type="button"
                  onClick={goToPermissionsTab}
                >
                  עבור להרשאות
                </MasterProjectV2PrimaryButton>
                <MasterProjectV2SecondaryButton
                  type="button"
                  onClick={() => setShareBlockDialog(null)}
                >
                  ביטול
                </MasterProjectV2SecondaryButton>
              </div>
            </div>
          </ForteV2Dialog>
        </ForteV2DialogOverlay>
      ) : null}
    </ForteV2TabShell>
  );
}
