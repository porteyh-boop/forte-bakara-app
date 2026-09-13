"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ForteV2Dialog,
  ForteV2DialogOverlay,
  ForteV2FormInput,
  ForteV2FormLabel,
  ForteV2PrimaryButton,
  ForteV2SecondaryButton,
  ForteV2StatusBadge,
  ForteV2StatusBanner,
} from "@/components/master-v2/project-v2/MasterProjectV2Workspace";
import { buildClientAccessUrl } from "@/lib/client-access";
import type { SalesLeadTrialPortalStatus } from "@/lib/sales-lead-trial-portal";
import {
  fetchSalesLeadTrialPortalStatus,
  provisionSalesLeadTrialPortal,
} from "@/lib/sales-leads-api";
import type { SalesLead } from "@/lib/sales-leads";

const TRIAL_DURATION_DAYS = [7, 14, 30] as const;
const MAX_ELEVATORS = 10;

function formatExpiryDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("he-IL", {
    timeZone: "Asia/Jerusalem",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function computeExpiresAtIso(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

function defaultElevatorNames(count: number): string[] {
  return Array.from({ length: count }, (_, index) => `מעלית ${index + 1}`);
}

function resolvePortalUrl(
  status: SalesLeadTrialPortalStatus | null,
  accessToken?: string | null
): string | null {
  if (accessToken?.trim()) {
    return buildClientAccessUrl(accessToken.trim());
  }
  if (!status?.accessPath) return null;
  const segment = status.accessPath.split("/").pop();
  if (!segment) return null;
  return buildClientAccessUrl(decodeURIComponent(segment));
}

function formatTrialPortalCreateError(error: string | null | undefined): string {
  switch (error) {
    case "missing_building_name":
      return "יש להזין שם בניין לפני פתיחת הפורטל.";
    case "missing_elevators":
      return "יש להגדיר לפחות מעלית אחת.";
    case "invalid_elevator_name":
      return "יש להזין שם לכל מעלית.";
    case "not_found":
      return "הליד לא נמצא.";
    default:
      return "לא ניתן היה לפתוח את הפורטל. נסה שוב.";
  }
}

function buildClientMessage(contactName: string | undefined, portalUrl: string): string {
  const greeting = contactName?.trim()
    ? `שלום ${contactName.trim()},`
    : "שלום,";

  return `${greeting}

נפתח עבורך פורטל ניסיון של FORTE לצפייה ובקרה על פעילות המעליות בבניין.

לכניסה לפורטל:
${portalUrl}

הפורטל פתוח עבורך לתקופת הניסיון.

FORTE`;
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
  const hasPortal = Boolean(lead.trialBuildingId?.trim());

  const [status, setStatus] = useState<SalesLeadTrialPortalStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [durationDays, setDurationDays] = useState<number>(30);
  const [elevatorCount, setElevatorCount] = useState(1);
  const [elevatorNames, setElevatorNames] = useState<string[]>(() =>
    defaultElevatorNames(1)
  );
  const [alreadyProvisionedBanner, setAlreadyProvisionedBanner] = useState(false);

  const refreshStatus = useCallback(async () => {
    if (!lead.id || !lead.trialBuildingId?.trim()) {
      setStatus(null);
      return;
    }
    setLoadingStatus(true);
    const result = await fetchSalesLeadTrialPortalStatus(lead.id);
    setStatus(result.status);
    if (result.error) {
      console.error("[trial-portal] status load failed", result.error);
    }
    setLoadingStatus(false);
  }, [lead.id, lead.trialBuildingId]);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus, lead.trialBuildingId, lead.trialClientUserId]);

  useEffect(() => {
    setElevatorNames((prev) => {
      const next = prev.slice(0, elevatorCount);
      while (next.length < elevatorCount) {
        next.push(`מעלית ${next.length + 1}`);
      }
      return next;
    });
  }, [elevatorCount]);

  const portalUrl = useMemo(() => resolvePortalUrl(status), [status]);

  const expiryLabel = useMemo(
    () => formatExpiryDate(status?.expiresAt),
    [status?.expiresAt]
  );

  const buildingLabel = lead.trialBuildingId?.trim() || status?.buildingId || "—";

  function openCreateDialog() {
    setFormError(null);
    setAlreadyProvisionedBanner(false);
    setDurationDays(30);
    setElevatorCount(1);
    setElevatorNames(defaultElevatorNames(1));
    if (!lead.buildingName?.trim()) {
      onMessage("יש להזין שם בניין לפני פתיחת הפורטל.");
      return;
    }
    setCreateDialogOpen(true);
  }

  async function handleCopyLink() {
    if (!portalUrl) return;
    try {
      await navigator.clipboard.writeText(portalUrl);
      onMessage("הקישור הועתק");
    } catch (error) {
      console.error("[trial-portal] copy link failed", error);
      onMessage("לא ניתן להעתיק את הקישור.");
    }
  }

  async function handleCopyClientMessage() {
    if (!portalUrl) return;
    const text = buildClientMessage(lead.contactName, portalUrl);
    try {
      await navigator.clipboard.writeText(text);
      onMessage("הודעת הלקוח הועתקה");
    } catch (error) {
      console.error("[trial-portal] copy client message failed", error);
      onMessage("לא ניתן להעתיק את ההודעה.");
    }
  }

  function handleOpenPortal() {
    if (!portalUrl) return;
    window.open(portalUrl, "_blank", "noopener,noreferrer");
  }

  async function handleProvision() {
    setFormError(null);

    if (!lead.buildingName?.trim()) {
      setFormError("יש להזין שם בניין לפני פתיחת הפורטל.");
      return;
    }

    if (elevatorNames.length < 1) {
      setFormError("יש להגדיר לפחות מעלית אחת.");
      return;
    }

    const trimmedNames = elevatorNames.map((name) => name.trim());
    if (trimmedNames.some((name) => !name)) {
      setFormError("יש להזין שם לכל מעלית.");
      return;
    }

    const expiresAt = computeExpiresAtIso(durationDays);

    setSaving(true);
    const result = await provisionSalesLeadTrialPortal(lead.id, {
      expiresAt,
      elevatorNames: trimmedNames,
    });
    setSaving(false);

    if (result.error) {
      console.error("[trial-portal] provision failed", result.error);
      setFormError(formatTrialPortalCreateError(result.error));
      return;
    }

    const already = result.result?.alreadyProvisioned === true;

    if (result.lead) {
      onLeadUpdated(result.lead);
    }
    if (result.status) {
      setStatus(result.status);
    } else if (result.lead?.trialBuildingId) {
      const loaded = await fetchSalesLeadTrialPortalStatus(lead.id);
      setStatus(loaded.status);
    }

    setCreateDialogOpen(false);
    setAlreadyProvisionedBanner(already);

    if (already) {
      onMessage("הפורטל כבר קיים ונפתח לשימוש.");
    } else {
      onMessage(null);
    }
  }

  return (
    <section
      className="mb-4 space-y-3 rounded-xl border border-forte-border bg-forte-background/40 px-3 py-3"
      dir="rtl"
    >
      <h4 className="text-sm font-semibold text-forte-text">פורטל ניסיון</h4>

      {hasPortal ? (
        <div className="space-y-3 text-sm text-forte-text">
          {alreadyProvisionedBanner ? (
            <ForteV2StatusBanner tone="info">
              הפורטל כבר קיים ונפתח לשימוש.
            </ForteV2StatusBanner>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            <ForteV2StatusBadge tone="success">פורטל ניסיון פעיל</ForteV2StatusBadge>
            {loadingStatus ? (
              <span className="text-xs text-forte-text-secondary">טוען פרטים…</span>
            ) : null}
          </div>

          <p>
            מספר פורטל: <span className="font-medium">{buildingLabel}</span>
          </p>

          {expiryLabel ? (
            <p className="text-forte-text-secondary">תוקף עד: {expiryLabel}</p>
          ) : null}

          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap [&_button]:min-h-[44px] [&_button]:w-full sm:[&_button]:w-auto">
            <ForteV2PrimaryButton
              type="button"
              size="sm"
              onClick={handleOpenPortal}
              disabled={!portalUrl || loadingStatus}
            >
              פתח פורטל
            </ForteV2PrimaryButton>
            <ForteV2SecondaryButton
              type="button"
              size="sm"
              onClick={() => void handleCopyLink()}
              disabled={!portalUrl || loadingStatus}
            >
              העתק קישור
            </ForteV2SecondaryButton>
            <ForteV2SecondaryButton
              type="button"
              size="sm"
              onClick={() => void handleCopyClientMessage()}
              disabled={!portalUrl || loadingStatus}
            >
              העתק הודעה ללקוח
            </ForteV2SecondaryButton>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-forte-text-secondary">
            יצירת בניין ניסיון, מעליות וקישור אישי לוועד — ללא שינוי סטטוס הליד.
          </p>
          <div className="[&_button]:min-h-[44px] [&_button]:w-full sm:[&_button]:w-auto">
            <ForteV2PrimaryButton
              type="button"
              onClick={openCreateDialog}
              disabled={!lead.buildingName?.trim()}
            >
              פתיחת פורטל ניסיון
            </ForteV2PrimaryButton>
          </div>
          {!lead.buildingName?.trim() ? (
            <p className="text-xs text-amber-800">
              יש להזין שם בניין בכרטיס הליד לפני פתיחת הפורטל.
            </p>
          ) : null}
        </div>
      )}

      {createDialogOpen ? (
        <ForteV2DialogOverlay onClose={() => !saving && setCreateDialogOpen(false)}>
          <ForteV2Dialog
            title="פתיחת פורטל ניסיון"
            onClose={() => !saving && setCreateDialogOpen(false)}
            size="lg"
          >
            <div className="space-y-4 px-1 pb-1" dir="rtl">
              {formError ? (
                <ForteV2StatusBanner tone="error">{formError}</ForteV2StatusBanner>
              ) : null}

              <label className="block space-y-1">
                <ForteV2FormLabel htmlFor="trial-portal-duration">תוקף הפורטל</ForteV2FormLabel>
                <select
                  id="trial-portal-duration"
                  className="fv2-input w-full min-h-[44px]"
                  value={String(durationDays)}
                  disabled={saving}
                  onChange={(event) => setDurationDays(Number(event.target.value))}
                >
                  {TRIAL_DURATION_DAYS.map((days) => (
                    <option key={days} value={days}>
                      {days} ימים
                    </option>
                  ))}
                </select>
              </label>

              <label className="block space-y-1">
                <ForteV2FormLabel htmlFor="trial-portal-elevator-count">
                  מספר מעליות
                </ForteV2FormLabel>
                <select
                  id="trial-portal-elevator-count"
                  className="fv2-input w-full min-h-[44px]"
                  value={String(elevatorCount)}
                  disabled={saving}
                  onChange={(event) => {
                    const next = Number(event.target.value);
                    if (next >= 1 && next <= MAX_ELEVATORS) {
                      setElevatorCount(next);
                    }
                  }}
                >
                  {Array.from({ length: MAX_ELEVATORS }, (_, index) => index + 1).map(
                    (count) => (
                      <option key={count} value={count}>
                        {count}
                      </option>
                    )
                  )}
                </select>
              </label>

              <div className="space-y-2">
                <p className="fv2-label">שמות מעליות</p>
                {elevatorNames.map((name, index) => (
                  <label key={index} className="block space-y-1">
                    <ForteV2FormLabel htmlFor={`trial-elevator-${index}`}>
                      שם מעלית {index + 1}
                    </ForteV2FormLabel>
                    <ForteV2FormInput
                      id={`trial-elevator-${index}`}
                      value={name}
                      disabled={saving}
                      className="min-h-[44px]"
                      onChange={(event) => {
                        const value = event.target.value;
                        setElevatorNames((prev) => {
                          const next = [...prev];
                          next[index] = value;
                          return next;
                        });
                      }}
                    />
                  </label>
                ))}
              </div>

              <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end [&_button]:min-h-[44px] [&_button]:w-full sm:[&_button]:w-auto">
                <ForteV2SecondaryButton
                  type="button"
                  onClick={() => setCreateDialogOpen(false)}
                  disabled={saving}
                >
                  ביטול
                </ForteV2SecondaryButton>
                <ForteV2PrimaryButton
                  type="button"
                  disabled={saving}
                  onClick={() => void handleProvision()}
                >
                  {saving ? "יוצר פורטל..." : "צור פורטל"}
                </ForteV2PrimaryButton>
              </div>
            </div>
          </ForteV2Dialog>
        </ForteV2DialogOverlay>
      ) : null}
    </section>
  );
}
