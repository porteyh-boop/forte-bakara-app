"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ForteV2Dialog,
  ForteV2DialogOverlay,
  ForteV2FormInput,
  ForteV2FormLabel,
  ForteV2PrimaryButton,
  ForteV2SecondaryButton,
  ForteV2StatusBanner,
} from "@/components/master-v2/project-v2/MasterProjectV2Workspace";
import { buildClientAccessUrl } from "@/lib/client-access";
import {
  deactivateMasterClientAccess,
  reactivateMasterClientAccess,
} from "@/lib/master-client-access-api";
import type { SalesLeadTrialPortalStatus } from "@/lib/sales-lead-trial-portal";
import {
  fetchSalesLeadTrialPortalStatus,
  provisionSalesLeadTrialPortal,
} from "@/lib/sales-leads-api";
import type { SalesLead } from "@/lib/sales-leads";

function defaultExpiresAtLocal(): string {
  const date = new Date();
  date.setDate(date.getDate() + 30);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatTrialGate(status: SalesLeadTrialPortalStatus): string {
  if (status.gate === "none") return "לא נפתח";
  if (status.gate === "ok") return "פעיל";
  if (status.gate === "expired") return "פג תוקף";
  if (status.gate === "deactivated") return "מושבת";
  return "לא זמין";
}

interface MasterSalesLeadTrialPortalSectionProps {
  lead: SalesLead;
  onLeadUpdated: (lead: SalesLead) => void;
  onMessage: (message: string | null) => void;
}

export default function MasterSalesLeadTrialPortalSection({
  lead,
  onLeadUpdated,
  onMessage,
}: MasterSalesLeadTrialPortalSectionProps) {
  const [status, setStatus] = useState<SalesLeadTrialPortalStatus | null>(null);
  const [canProvision, setCanProvision] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState(defaultExpiresAtLocal);
  const [elevatorLines, setElevatorLines] = useState("מעלית 1\nמעלית 2");

  const refreshStatus = useCallback(async () => {
    if (!lead.id) {
      setStatus(null);
      setCanProvision(false);
      return;
    }
    setLoadingStatus(true);
    const result = await fetchSalesLeadTrialPortalStatus(lead.id);
    setStatus(result.status);
    setCanProvision(result.canProvision);
    if (result.error) onMessage(result.error);
    setLoadingStatus(false);
  }, [lead.id, onMessage]);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus, lead.trialBuildingId, lead.trialClientUserId]);

  const portalUrl = useMemo(() => {
    if (!status?.accessPath) return null;
    const token = status.accessPath.split("/").pop();
    return token ? buildClientAccessUrl(decodeURIComponent(token)) : null;
  }, [status?.accessPath]);

  async function handleCopyLink() {
    if (!portalUrl) return;
    try {
      await navigator.clipboard.writeText(portalUrl);
      onMessage("קישור הניסיון הועתק");
    } catch {
      onMessage(portalUrl);
    }
  }

  async function handleProvision() {
    setFormError(null);
    const elevatorNames = elevatorLines
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    if (elevatorNames.length === 0) {
      setFormError("יש להזין לפחות מעלית אחת.");
      return;
    }

    let expiresIso: string;
    try {
      expiresIso = new Date(expiresAt).toISOString();
      if (Number.isNaN(new Date(expiresAt).getTime())) {
        setFormError("תאריך התפוגה אינו תקין.");
        return;
      }
    } catch {
      setFormError("תאריך התפוגה אינו תקין.");
      return;
    }

    setSaving(true);
    const result = await provisionSalesLeadTrialPortal(lead.id, {
      expiresAt: expiresIso,
      elevatorNames,
    });
    setSaving(false);

    if (result.error || !result.lead) {
      setFormError(result.error ?? "פתיחת הניסיון נכשלה");
      return;
    }

    onLeadUpdated(result.lead);
    if (result.status) {
      setStatus(result.status);
    } else {
      await refreshStatus();
    }
    setDialogOpen(false);
    onMessage(
      result.result?.alreadyProvisioned
        ? "פורטל הניסיון כבר קיים — הוחזר הקישור הקיים."
        : "פורטל הניסיון נפתח — ניתן להעתיק את הקישור למטה."
    );
  }

  async function handleToggleAccess() {
    const userId = status?.clientUserId ?? lead.trialClientUserId;
    const buildingId = status?.buildingId ?? lead.trialBuildingId;
    if (!userId || !buildingId) return;

    setActionId(userId);
    const deactivate = status?.isActive !== false && status?.gate === "ok";
    const ok = deactivate
      ? await deactivateMasterClientAccess(userId, buildingId)
      : await reactivateMasterClientAccess(userId, buildingId);
    setActionId(null);
    onMessage(ok ? (deactivate ? "קישור הניסיון הושבת" : "קישור הניסיון הופעל") : "הפעולה נכשלה");
    if (ok) await refreshStatus();
  }

  return (
    <section className="space-y-2 rounded-xl border border-forte-border bg-forte-background/40 px-3 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-sm font-semibold text-forte-text">פורטל ניסיון</h4>
        <ForteV2SecondaryButton
          type="button"
          size="sm"
          onClick={() => {
            setFormError(null);
            setDialogOpen(true);
          }}
          disabled={!lead.trialBuildingId && !canProvision}
        >
          {lead.trialBuildingId ? "פרטי ניסיון" : "פתיחת פורטל ניסיון"}
        </ForteV2SecondaryButton>
      </div>

      {lead.trialBuildingId ? (
        <div className="space-y-2 text-sm text-forte-text">
          <p>
            מצב:{" "}
            <span className="font-medium">
              {loadingStatus
                ? "טוען…"
                : formatTrialGate(
                    status ?? {
                      gate: "invalid",
                      buildingId: lead.trialBuildingId ?? "",
                      clientUserId: lead.trialClientUserId,
                      accessPath: null,
                      expiresAt: null,
                      isActive: false,
                    }
                  )}
            </span>
          </p>
          {status?.expiresAt ? (
            <p className="text-xs text-forte-text-secondary">
              תוקף:{" "}
              {new Date(status.expiresAt).toLocaleString("he-IL", {
                timeZone: "Asia/Jerusalem",
              })}
            </p>
          ) : null}
          {portalUrl ? (
            <p className="break-all text-xs text-forte-text-secondary">{portalUrl}</p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <ForteV2SecondaryButton
              size="sm"
              onClick={() => void handleCopyLink()}
              disabled={!portalUrl}
            >
              העתק קישור
            </ForteV2SecondaryButton>
            <ForteV2SecondaryButton
              size="sm"
              onClick={() => void handleToggleAccess()}
              disabled={!status?.clientUserId || Boolean(actionId)}
            >
              {status?.isActive === false || status?.gate === "deactivated"
                ? "הפעל קישור"
                : "השבת קישור"}
            </ForteV2SecondaryButton>
          </div>
        </div>
      ) : canProvision ? (
        <p className="text-xs text-forte-text-secondary">
          ליד QA מורשה — ניתן לפתוח פורטל ניסיון. האכיפה (דגל + allowlist + סימון QA) בשרת.
        </p>
      ) : (
        <p className="text-xs text-forte-text-secondary">
          פתיחת ניסיון זמינה רק ללידים מסומני QA שמופיעים ב-allowlist והמתג פעיל בשרת.
        </p>
      )}

      {dialogOpen ? (
        <ForteV2DialogOverlay onClose={() => setDialogOpen(false)}>
          <ForteV2Dialog
            title={lead.trialBuildingId ? "פרטי פורטל ניסיון" : "פתיחת פורטל ניסיון"}
            onClose={() => setDialogOpen(false)}
            size="md"
          >
            {lead.trialBuildingId ? (
              <div className="space-y-3 text-sm">
                <p>בניין ניסיון: {lead.trialBuildingId}</p>
                <p className="text-forte-text-secondary">
                  לשינוי מעליות או תאריך תפוגה — פנו לתמיכה או השתמשו בכרטיס הפרויקט לאחר זכייה.
                </p>
                <div className="flex justify-end">
                  <ForteV2SecondaryButton onClick={() => setDialogOpen(false)}>
                    סגור
                  </ForteV2SecondaryButton>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-forte-text-secondary">
                  ייווצרו בניין ניסיון, מעליות וקישור אישי — ללא שינוי סטטוס הליד וללא סכום הזמנה.
                </p>
                {formError ? (
                  <ForteV2StatusBanner tone="error">{formError}</ForteV2StatusBanner>
                ) : null}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-forte-text-secondary">בניין</p>
                    <p className="font-medium">{lead.buildingName || "—"}</p>
                  </div>
                  <div>
                    <p className="text-forte-text-secondary">איש קשר</p>
                    <p className="font-medium">{lead.contactName || "—"}</p>
                  </div>
                </div>
                <label className="block space-y-1">
                  <ForteV2FormLabel>תאריך תפוגה *</ForteV2FormLabel>
                  <ForteV2FormInput
                    type="datetime-local"
                    value={expiresAt}
                    onChange={(event) => setExpiresAt(event.target.value)}
                    required
                  />
                </label>
                <label className="block space-y-1">
                  <ForteV2FormLabel>מעליות (שורה לכל מעלית) *</ForteV2FormLabel>
                  <textarea
                    className="fv2-input w-full min-h-[96px]"
                    value={elevatorLines}
                    onChange={(event) => setElevatorLines(event.target.value)}
                    required
                  />
                </label>
                <div className="flex flex-wrap justify-end gap-2">
                  <ForteV2SecondaryButton
                    type="button"
                    onClick={() => setDialogOpen(false)}
                    disabled={saving}
                  >
                    ביטול
                  </ForteV2SecondaryButton>
                  <ForteV2PrimaryButton
                    type="button"
                    disabled={saving}
                    onClick={() => void handleProvision()}
                  >
                    {saving ? "יוצר…" : "פתיחת פורטל"}
                  </ForteV2PrimaryButton>
                </div>
              </div>
            )}
          </ForteV2Dialog>
        </ForteV2DialogOverlay>
      ) : null}
    </section>
  );
}
