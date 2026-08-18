"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import MasterClientPermissionsModal from "@/components/MasterClientPermissionsModal";
import MasterProjectV2ClientAccessExpiryDialog from "@/components/master-v2/project-v2/MasterProjectV2ClientAccessExpiryDialog";
import MasterProjectV2NewClientAccessDialog from "@/components/master-v2/project-v2/MasterProjectV2NewClientAccessDialog";
import {
  ForteV2DangerButton,
  ForteV2StatusBadge,
  ForteV2TabShell,
  MasterProjectV2EmptyState,
  MasterProjectV2PrimaryButton,
  MasterProjectV2SecondaryButton,
  MasterProjectV2StatusBanner,
} from "@/components/master-v2/project-v2/MasterProjectV2Workspace";
import {
  buildClientAccessUrl,
  CLIENT_ACCESS_STATUS_LABELS,
  formatClientAccessExpiry,
  getClientAccessDisplayStatus,
  type ClientUserAccessListItem,
} from "@/lib/client-access";
import { formatClientPermissionsSummary, type ClientPermissionFlags } from "@/lib/client-permissions";
import {
  deactivateMasterClientAccess,
  getMasterClientPermissionsOrDefaults,
  isMasterClientAccessConfigured,
  listMasterClientAccessRecords,
  reactivateMasterClientAccess,
} from "@/lib/master-client-access-api";
import { getAllCloudElevators } from "@/lib/buildings-cloud";
import { getBuildingDataset } from "@/lib/buildings";
import {
  isProjectContactsConfigured,
  listProjectContacts,
} from "@/lib/project-contacts-cloud";
import type { ProjectContactWithDetails } from "@/lib/contacts";

interface MasterProjectV2PermissionsTabProps {
  buildingId: string;
}

interface ElevatorOption {
  id: string;
  name: string;
}

function formatScopeLabel(
  item: ClientUserAccessListItem,
  elevatorNameById: Map<string, string>
): string {
  if (item.access.access_level === "elevator" && item.access.elevator_id) {
    return (
      elevatorNameById.get(item.access.elevator_id) ?? item.access.elevator_id
    );
  }
  return "כל הבניין";
}
function resolveContactMeta(
  item: ClientUserAccessListItem,
  contacts: ProjectContactWithDetails[]
): { company: string; role: string } {
  const email = item.user.email?.trim().toLowerCase() ?? "";
  const phone = item.user.phone?.replace(/\D/g, "") ?? "";

  const match = contacts.find((contact) => {
    if (email && contact.email.trim().toLowerCase() === email) return true;
    if (phone && contact.phone.replace(/\D/g, "") === phone) return true;
    return false;
  });

  if (!match) return { company: "", role: "" };
  return {
    company: match.company,
    role: match.roleTitle || match.projectRole,
  };
}

export default function MasterProjectV2PermissionsTab({
  buildingId,
}: MasterProjectV2PermissionsTabProps) {
  const cloudReady = isMasterClientAccessConfigured();
  const contactsConfigured = isProjectContactsConfigured();

  const [records, setRecords] = useState<ClientUserAccessListItem[]>([]);
  const [permissionsByUserId, setPermissionsByUserId] = useState<
    Record<string, ClientPermissionFlags>
  >({});
  const [projectContacts, setProjectContacts] = useState<
    ProjectContactWithDetails[]
  >([]);
  const [elevatorOptions, setElevatorOptions] = useState<ElevatorOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [permissionsClient, setPermissionsClient] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [expiryClient, setExpiryClient] = useState<ClientUserAccessListItem | null>(
    null
  );

  const elevatorNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const elevator of elevatorOptions) {
      map.set(elevator.id, elevator.name);
    }
    return map;
  }, [elevatorOptions]);

  const visibleRecords = useMemo(
    () =>
      records.filter((item) => item.access.building_id === buildingId),
    [records, buildingId]
  );

  const loadElevators = useCallback(async () => {
    if (cloudReady) {
      const rows = await getAllCloudElevators();
      setElevatorOptions(
        rows
          .filter((row) => row.building_id === buildingId && row.is_active)
          .map((row) => ({
            id: row.elevator_id,
            name: row.elevator_name,
          }))
      );
      return;
    }

    try {
      setElevatorOptions(
        getBuildingDataset(buildingId).elevators.map((elevator) => ({
          id: elevator.id,
          name: elevator.name,
        }))
      );
    } catch {
      setElevatorOptions([]);
    }
  }, [buildingId, cloudReady]);

  const refresh = useCallback(async () => {
    if (!cloudReady) {
      setRecords([]);
      setPermissionsByUserId({});
      setLoading(false);
      return;
    }

    setLoading(true);
    const rows = await listMasterClientAccessRecords();
    setRecords(rows);

    const buildingRows = rows.filter(
      (item) => item.access.building_id === buildingId
    );
    const permissionEntries = await Promise.all(
      buildingRows.map(async (item) => {
        const flags = await getMasterClientPermissionsOrDefaults(item.user.id);
        return [item.user.id, flags] as const;
      })
    );
    setPermissionsByUserId(Object.fromEntries(permissionEntries));
    setLoading(false);
  }, [buildingId, cloudReady]);

  const refreshContacts = useCallback(async () => {
    if (!contactsConfigured) {
      setProjectContacts([]);
      return;
    }
    const result = await listProjectContacts(buildingId);
    setProjectContacts(result.contacts);
  }, [buildingId, contactsConfigured]);

  useEffect(() => {
    void loadElevators();
  }, [loadElevators]);

  useEffect(() => {
    void refresh();
    void refreshContacts();
  }, [refresh, refreshContacts]);

  async function handleCopyLink(token: string) {
    const url = buildClientAccessUrl(token);
    try {
      await navigator.clipboard.writeText(url);
      setMessage("הקישור הועתק");
    } catch {
      setMessage(url);
    }
  }

  function handleOpenLink(token: string) {
    window.open(buildClientAccessUrl(token), "_blank", "noopener,noreferrer");
  }

  async function handleDeactivate(userId: string) {
    setActionId(userId);
    const ok = await deactivateMasterClientAccess(userId);
    setActionId(null);
    setMessage(ok ? "הגישה הושבתה" : "השבתת הגישה נכשלה");
    if (ok) await refresh();
  }

  async function handleReactivate(userId: string) {
    setActionId(userId);
    const ok = await reactivateMasterClientAccess(userId);
    setActionId(null);
    setMessage(ok ? "הגישה הופעלה מחדש" : "הפעלה מחדש נכשלה");
    if (ok) await refresh();
  }

  return (
    <ForteV2TabShell
      workspace="project-v2-permissions"
      title="הרשאות לקוח"
      description="גישת לקוח, קישורים אישיים והרשאות לפי היקף"
      actions={
        <MasterProjectV2PrimaryButton
          onClick={() => setCreateOpen(true)}
          disabled={!cloudReady}
          size="sm"
        >
          + לקוח חדש
        </MasterProjectV2PrimaryButton>
      }
    >

      {!cloudReady && (
        <MasterProjectV2StatusBanner tone="error">
          Supabase לא מוגדר. הגדירו NEXT_PUBLIC_SUPABASE_URL ו-
          NEXT_PUBLIC_SUPABASE_ANON_KEY.
        </MasterProjectV2StatusBanner>
      )}

      {message && (
        <MasterProjectV2StatusBanner tone="info">{message}</MasterProjectV2StatusBanner>
      )}

      {loading ? (
        <p className="text-xs text-forte-text-secondary py-4">טוען גישות לקוחות...</p>
      ) : visibleRecords.length === 0 ? (
        <MasterProjectV2EmptyState
          title="אין גישות לקוחות לפרויקט זה"
          description="לחצו על «+ לקוח חדש» כדי ליצור קישור גישה אישי."
          actions={
            cloudReady ? (
              <MasterProjectV2PrimaryButton onClick={() => setCreateOpen(true)}>
                + לקוח חדש
              </MasterProjectV2PrimaryButton>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-3">
          {visibleRecords.map((item) => {
            const status = getClientAccessDisplayStatus(item.user);
            const contactMeta = resolveContactMeta(item, projectContacts);
            const permissions = permissionsByUserId[item.user.id];
            const permissionSummary = permissions
              ? formatClientPermissionsSummary(permissions)
              : "טוען הרשאות...";

            return (
              <article key={item.user.id} className="fv2-list-card">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="fv2-list-card-title">{item.user.name}</p>
                    {(contactMeta.company || contactMeta.role) && (
                      <p className="fv2-list-card-meta mt-0.5">
                        {[contactMeta.company, contactMeta.role]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    )}
                    <p className="fv2-list-card-meta">
                      {item.user.phone || "—"} · {item.user.email || "—"}
                    </p>
                  </div>
                  <ForteV2StatusBadge
                    tone={
                      status === "active"
                        ? "success"
                        : status === "expired"
                          ? "warning"
                          : "danger"
                    }
                  >
                    {CLIENT_ACCESS_STATUS_LABELS[status]}
                  </ForteV2StatusBadge>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 fv2-list-card-meta mt-2">
                  <p>
                    <span className="font-semibold text-forte-text/80">היקף: </span>
                    {formatScopeLabel(item, elevatorNameById)}
                  </p>
                  <p>
                    <span className="font-semibold text-forte-text/80">תוקף: </span>
                    {formatClientAccessExpiry(item.user.expires_at)}
                  </p>
                  <p className="sm:col-span-2">
                    <span className="font-semibold text-forte-text/80">הרשאות: </span>
                    {permissionSummary}
                  </p>
                </div>

                <div className="fv2-list-card-actions">
                  <MasterProjectV2SecondaryButton
                    onClick={() => void handleCopyLink(item.user.access_token)}
                  >
                    העתק קישור
                  </MasterProjectV2SecondaryButton>
                  <MasterProjectV2SecondaryButton
                    onClick={() => handleOpenLink(item.user.access_token)}
                  >
                    פתח קישור
                  </MasterProjectV2SecondaryButton>
                  <MasterProjectV2SecondaryButton
                    onClick={() =>
                      setPermissionsClient({
                        id: item.user.id,
                        name: item.user.name,
                      })
                    }
                  >
                    ערוך הרשאות
                  </MasterProjectV2SecondaryButton>
                  <MasterProjectV2SecondaryButton
                    onClick={() => setExpiryClient(item)}
                  >
                    שינוי תוקף
                  </MasterProjectV2SecondaryButton>
                  {item.user.is_active ? (
                    <ForteV2DangerButton
                      outline
                      onClick={() => void handleDeactivate(item.user.id)}
                      disabled={actionId === item.user.id}
                    >
                      השבת
                    </ForteV2DangerButton>
                  ) : (
                    <MasterProjectV2SecondaryButton
                      onClick={() => void handleReactivate(item.user.id)}
                      disabled={actionId === item.user.id}
                      size="sm"
                    >
                      הפעל
                    </MasterProjectV2SecondaryButton>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      <MasterProjectV2NewClientAccessDialog
        open={createOpen}
        buildingId={buildingId}
        projectContacts={projectContacts}
        existingRecords={records}
        elevatorOptions={elevatorOptions}
        onClose={() => setCreateOpen(false)}
        onCreated={() => {
          setMessage("הגישה נוצרה בהצלחה");
          void refresh();
        }}
      />

      {permissionsClient && (
        <MasterClientPermissionsModal
          clientUserId={permissionsClient.id}
          clientName={permissionsClient.name}
          open={Boolean(permissionsClient)}
          useMasterApi
          onClose={() => setPermissionsClient(null)}
          onSaved={() => {
            setMessage("ההרשאות נשמרו");
            void refresh();
          }}
        />
      )}

      {expiryClient && (
        <MasterProjectV2ClientAccessExpiryDialog
          open={Boolean(expiryClient)}
          clientUserId={expiryClient.user.id}
          clientName={expiryClient.user.name}
          buildingId={buildingId}
          accessLevel={expiryClient.access.access_level}
          elevatorId={expiryClient.access.elevator_id}
          currentExpiresAt={expiryClient.user.expires_at}
          onClose={() => setExpiryClient(null)}
          onSaved={() => {
            setMessage("תוקף הקישור עודכן");
            void refresh();
          }}
        />
      )}
    </ForteV2TabShell>
  );
}
