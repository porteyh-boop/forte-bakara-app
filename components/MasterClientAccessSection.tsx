"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import MasterClientEditModal from "@/components/MasterClientEditModal";
import MasterClientPermissionsModal from "@/components/MasterClientPermissionsModal";
import {
  buildClientAccessUrl,
  CLIENT_TYPE_OPTIONS,
  createClientUserAccess,
  deactivateClientAccess,
  DEFAULT_CLIENT_WELCOME_MESSAGE,
  formatClientAccessExpiry,
  getAllClientUserAccessRecords,
  isClientAccessCloudConfigured,
  reactivateClientAccess,
  type ClientAccessLevel,
  type ClientType,
  type ClientUserAccessListItem,
} from "@/lib/client-access";
import {
  formatClientActivityAction,
  formatClientActivityDate,
  formatClientActivityDetails,
  getAllClientActivityLogs,
  type ClientActivityLogListItem,
} from "@/lib/client-permissions";
import { getAllCloudElevators } from "@/lib/buildings-cloud";
import {
  buildMasterBuildingList,
  formatMasterBuildingSources,
} from "@/lib/master-buildings-list";
import { getAllBuildingIds, getBuildingDataset } from "@/lib/buildings";
import { getAllPilotFaults } from "@/lib/pilot-cloud";

type ClientAccessView = "access" | "activityLog";

function formatScopeLabel(item: ClientUserAccessListItem): string {
  if (item.access.access_level === "elevator" && item.access.elevator_id) {
    return item.access.elevator_id;
  }
  return "כל הבניין";
}

export default function MasterClientAccessSection() {
  const cloudReady = isClientAccessCloudConfigured();
  const [view, setView] = useState<ClientAccessView>("access");
  const [records, setRecords] = useState<ClientUserAccessListItem[]>([]);
  const [activityLogs, setActivityLogs] = useState<ClientActivityLogListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [activityLoading, setActivityLoading] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [permissionsClient, setPermissionsClient] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [editClientId, setEditClientId] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [clientType, setClientType] = useState<ClientType | "">("");
  const [welcomeMessage, setWelcomeMessage] = useState(
    DEFAULT_CLIENT_WELCOME_MESSAGE
  );
  const [buildingId, setBuildingId] = useState(() => getAllBuildingIds()[0] ?? "");
  const [accessLevel, setAccessLevel] = useState<ClientAccessLevel>("building");
  const [elevatorId, setElevatorId] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [creating, setCreating] = useState(false);

  const refresh = useCallback(async () => {
    if (!cloudReady) {
      setRecords([]);
      return;
    }
    setLoading(true);
    const rows = await getAllClientUserAccessRecords();
    setRecords(rows);
    setLoading(false);
  }, [cloudReady]);

  const refreshActivityLogs = useCallback(async () => {
    if (!cloudReady) {
      setActivityLogs([]);
      return;
    }
    setActivityLoading(true);
    const rows = await getAllClientActivityLogs();
    setActivityLogs(rows);
    setActivityLoading(false);
  }, [cloudReady]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (view === "activityLog") {
      void refreshActivityLogs();
    }
  }, [view, refreshActivityLogs]);

  const buildingOptions = useMemo(() => {
    return buildMasterBuildingList({
      cloudBuildings: [],
      demoBuildingIds: getAllBuildingIds(),
      resolveDemoName: (id) => getBuildingDataset(id).building.name,
      resolveDemoCity: (id) => getBuildingDataset(id).building.city,
      faultBuildings: [],
    });
  }, []);

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

  useEffect(() => {
    if (accessLevel === "building") {
      setElevatorId("");
      return;
    }
    if (!elevatorId && elevatorOptions[0]) {
      setElevatorId(elevatorOptions[0].id);
    }
  }, [accessLevel, buildingId, elevatorId, elevatorOptions]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!cloudReady || !name.trim() || !buildingId) return;

    setCreating(true);
    setMessage(null);

    if (cloudReady) {
      await getAllCloudElevators();
      await getAllPilotFaults();
    }

    const created = await createClientUserAccess({
      name: name.trim(),
      phone: phone.trim() || undefined,
      email: email.trim() || undefined,
      clientType: clientType || null,
      welcomeMessage: welcomeMessage.trim() || DEFAULT_CLIENT_WELCOME_MESSAGE,
      buildingId,
      elevatorId: accessLevel === "elevator" ? elevatorId : null,
      accessLevel,
      expiresAt: expiresAt ? new Date(`${expiresAt}T23:59:59`).toISOString() : null,
    });

    setCreating(false);

    if (!created) {
      setMessage("יצירת גישת לקוח נכשלה. ודאו ש-Supabase מוגדר ושה-migration הורץ.");
      return;
    }

    setName("");
    setPhone("");
    setEmail("");
    setClientType("");
    setWelcomeMessage(DEFAULT_CLIENT_WELCOME_MESSAGE);
    setExpiresAt("");
    setMessage(`נוצר קישור גישה עבור ${created.user.name}`);
    await refresh();
  }

  async function handleCopyLink(token: string) {
    const url = buildClientAccessUrl(token);
    try {
      await navigator.clipboard.writeText(url);
      setMessage("הקישור הועתק");
    } catch {
      setMessage(url);
    }
  }

  async function handleDeactivate(userId: string) {
    setActionId(userId);
    const ok = await deactivateClientAccess(userId);
    setActionId(null);
    setMessage(ok ? "הגישה בוטלה" : "ביטול הגישה נכשל");
    if (ok) await refresh();
  }

  async function handleReactivate(userId: string) {
    setActionId(userId);
    const ok = await reactivateClientAccess(userId);
    setActionId(null);
    setMessage(ok ? "הגישה הופעלה מחדש" : "הפעלה מחדש נכשלה");
    if (ok) await refresh();
  }

  function handlePermissionsSaved() {
    setMessage("ההרשאות נשמרו");
    if (view === "activityLog") {
      void refreshActivityLogs();
    }
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-gold/30 p-4 space-y-2">
        <h2 className="text-base font-bold text-navy">ניהול גישות לקוחות</h2>
        <p className="text-sm text-gray-text">
          יצירת קישורי גישה אישיים ללקוחות — בניין שלם או מעלית בודדת.
          ביטול גישה אינו מוחק נתונים.
        </p>
        {!cloudReady && (
          <p className="text-sm text-red-600">
            Supabase לא מוגדר. הגדירו NEXT_PUBLIC_SUPABASE_URL ו-
            NEXT_PUBLIC_SUPABASE_ANON_KEY, והריצו את migrations 005 ו-013.
          </p>
        )}
        {message && (
          <p className="text-sm font-semibold text-navy bg-gray-light rounded-lg px-3 py-2">
            {message}
          </p>
        )}
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setView("access")}
          className={`flex-1 rounded-xl py-2.5 text-sm font-semibold transition-colors ${
            view === "access"
              ? "bg-navy text-white"
              : "bg-white border border-gray-200 text-navy"
          }`}
        >
          גישות לקוחות
        </button>
        <button
          type="button"
          onClick={() => setView("activityLog")}
          className={`flex-1 rounded-xl py-2.5 text-sm font-semibold transition-colors ${
            view === "activityLog"
              ? "bg-navy text-white"
              : "bg-white border border-gray-200 text-navy"
          }`}
        >
          יומן פעילות
        </button>
      </div>

      {view === "access" && (
        <>
          <form
            onSubmit={(e) => void handleCreate(e)}
            className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3"
          >
            <h3 className="text-sm font-bold text-navy">יצירת לקוח חדש</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs text-gray-text">שם</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="form-input mt-1"
                  required
                />
              </div>
              <div>
                <label className="text-xs text-gray-text">טלפון</label>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="form-input mt-1"
                />
              </div>
              <div>
                <label className="text-xs text-gray-text">אימייל</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="form-input mt-1"
                />
              </div>
              <div>
                <label className="text-xs text-gray-text">סוג לקוח</label>
                <select
                  value={clientType}
                  onChange={(e) =>
                    setClientType(e.target.value as ClientType | "")
                  }
                  className="form-input mt-1"
                >
                  <option value="">בחרו סוג לקוח</option>
                  {CLIENT_TYPE_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs text-gray-text">הודעת פתיחה לפורטל</label>
                <textarea
                  value={welcomeMessage}
                  onChange={(e) => setWelcomeMessage(e.target.value)}
                  rows={4}
                  className="form-input mt-1 resize-y min-h-[6rem]"
                />
              </div>
              <div>
                <label className="text-xs text-gray-text">תוקף קישור (אופציונלי)</label>
                <input
                  type="date"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                  className="form-input mt-1"
                />
              </div>
              <div>
                <label className="text-xs text-gray-text">בניין</label>
                <select
                  value={buildingId}
                  onChange={(e) => setBuildingId(e.target.value)}
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
                <label className="text-xs text-gray-text">היקף גישה</label>
                <select
                  value={accessLevel}
                  onChange={(e) =>
                    setAccessLevel(e.target.value as ClientAccessLevel)
                  }
                  className="form-input mt-1"
                >
                  <option value="building">כל הבניין</option>
                  <option value="elevator">מעלית בודדת</option>
                </select>
              </div>
              {accessLevel === "elevator" && (
                <div className="sm:col-span-2">
                  <label className="text-xs text-gray-text">מעלית</label>
                  <select
                    value={elevatorId}
                    onChange={(e) => setElevatorId(e.target.value)}
                    className="form-input mt-1"
                    required
                  >
                    {elevatorOptions.map((elevator) => (
                      <option key={elevator.id} value={elevator.id}>
                        {elevator.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            <button
              type="submit"
              disabled={!cloudReady || creating || !name.trim()}
              className="btn-primary w-full sm:w-auto disabled:opacity-50"
            >
              {creating ? "יוצר..." : "צור קישור גישה אישי"}
            </button>
          </form>

          <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-navy">לקוחות עם גישה</h3>
              <button
                type="button"
                onClick={() => void refresh()}
                disabled={!cloudReady || loading}
                className="text-xs font-semibold text-navy border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 disabled:opacity-50"
              >
                {loading ? "טוען..." : "רענון"}
              </button>
            </div>

            {records.length === 0 ? (
              <p className="text-sm text-gray-text">
                {cloudReady ? "אין לקוחות עם גישה." : "Supabase לא מחובר."}
              </p>
            ) : (
              <div className="space-y-3">
                {records.map((item) => {
                  const buildingLabel =
                    buildingOptions.find(
                      (building) => building.buildingId === item.access.building_id
                    )?.name ?? item.access.building_id;

                  return (
                    <article
                      key={item.user.id}
                      className="rounded-xl border border-gray-200 p-3 space-y-2"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-bold text-navy">
                            {item.user.name}
                          </p>
                          <p className="text-xs text-gray-text mt-0.5">
                            {buildingLabel} · {formatScopeLabel(item)}
                          </p>
                          <p className="text-xs text-gray-text">
                            {item.user.phone || "—"} · {item.user.email || "—"}
                          </p>
                          {item.user.client_type && (
                            <p className="text-xs text-gray-text">
                              סוג לקוח: {item.user.client_type}
                            </p>
                          )}
                        </div>
                        <span
                          className={`text-xs font-semibold rounded-full px-2.5 py-1 ${
                            item.user.is_active
                              ? "bg-green-50 text-green-700 border border-green-200"
                              : "bg-red-50 text-red-700 border border-red-200"
                          }`}
                        >
                          {item.user.is_active ? "פעיל" : "חסום"}
                        </span>
                      </div>

                      <p className="text-xs text-gray-text">
                        תוקף: {formatClientAccessExpiry(item.user.expires_at)}
                      </p>
                      <p className="text-[11px] text-gray-text break-all">
                        {buildClientAccessUrl(item.user.access_token)}
                      </p>

                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => setEditClientId(item.user.id)}
                          className="text-xs font-semibold text-navy border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50"
                        >
                          ערוך לקוח
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setPermissionsClient({
                              id: item.user.id,
                              name: item.user.name,
                            })
                          }
                          className="text-xs font-semibold text-navy border border-gold/40 bg-gold/5 rounded-lg px-3 py-1.5 hover:bg-gold/10"
                        >
                          ניהול הרשאות
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleCopyLink(item.user.access_token)}
                          className="text-xs font-semibold text-navy border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50"
                        >
                          העתק קישור
                        </button>
                        {item.user.is_active ? (
                          <button
                            type="button"
                            onClick={() => void handleDeactivate(item.user.id)}
                            disabled={actionId === item.user.id}
                            className="text-xs font-semibold text-red-700 border border-red-200 rounded-lg px-3 py-1.5 hover:bg-red-50 disabled:opacity-50"
                          >
                            בטל גישה
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => void handleReactivate(item.user.id)}
                            disabled={actionId === item.user.id}
                            className="text-xs font-semibold text-green-700 border border-green-200 rounded-lg px-3 py-1.5 hover:bg-green-50 disabled:opacity-50"
                          >
                            הפעל מחדש
                          </button>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>

          <p className="text-[11px] text-gray-text">
            מקורות בניינים:{" "}
            {buildingOptions
              .slice(0, 3)
              .map((building) => formatMasterBuildingSources(building.sources))
              .join(" · ")}
          </p>
        </>
      )}

      {view === "activityLog" && (
        <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-navy">יומן פעילות</h3>
              <p className="text-xs text-gray-text mt-0.5">
                פעולות הרשאות וניהול לקוחות
              </p>
            </div>
            <button
              type="button"
              onClick={() => void refreshActivityLogs()}
              disabled={!cloudReady || activityLoading}
              className="text-xs font-semibold text-navy border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 disabled:opacity-50"
            >
              {activityLoading ? "טוען..." : "רענון"}
            </button>
          </div>

          {activityLogs.length === 0 ? (
            <p className="text-sm text-gray-text">
              {cloudReady ? "אין פעילות מתועדת." : "Supabase לא מחובר."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[36rem] text-sm">
                <thead>
                  <tr className="text-xs text-gray-text border-b border-gray-200">
                    <th className="text-right py-2 px-2 font-semibold">תאריך</th>
                    <th className="text-right py-2 px-2 font-semibold">לקוח</th>
                    <th className="text-right py-2 px-2 font-semibold">פעולה</th>
                    <th className="text-right py-2 px-2 font-semibold">פרטים</th>
                  </tr>
                </thead>
                <tbody>
                  {activityLogs.map((entry) => (
                    <tr key={entry.id} className="border-b border-gray-100 align-top">
                      <td className="py-2 px-2 text-xs whitespace-nowrap">
                        {formatClientActivityDate(entry.created_at)}
                      </td>
                      <td className="py-2 px-2 text-xs font-semibold text-navy">
                        {entry.client_name}
                      </td>
                      <td className="py-2 px-2 text-xs">
                        {formatClientActivityAction(entry.action_type)}
                      </td>
                      <td className="py-2 px-2 text-xs text-gray-text max-w-[20rem]">
                        {formatClientActivityDetails(entry.action_details)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {editClientId && (
        <MasterClientEditModal
          clientUserId={editClientId}
          open={Boolean(editClientId)}
          onClose={() => setEditClientId(null)}
          onSaved={() => {
            setMessage("פרטי הלקוח עודכנו");
            void refresh();
          }}
        />
      )}

      {permissionsClient && (
        <MasterClientPermissionsModal
          clientUserId={permissionsClient.id}
          clientName={permissionsClient.name}
          open={Boolean(permissionsClient)}
          onClose={() => setPermissionsClient(null)}
          onSaved={handlePermissionsSaved}
        />
      )}
    </div>
  );
}
