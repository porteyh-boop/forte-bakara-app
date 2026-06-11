"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  buildClientAccessUrl,
  createClientUserAccess,
  deactivateClientAccess,
  formatClientAccessExpiry,
  getAllClientUserAccessRecords,
  isClientAccessCloudConfigured,
  reactivateClientAccess,
  type ClientAccessLevel,
  type ClientUserAccessListItem,
} from "@/lib/client-access";
import { getAllCloudElevators } from "@/lib/buildings-cloud";
import {
  buildMasterBuildingList,
  formatMasterBuildingSources,
} from "@/lib/master-buildings-list";
import { getAllBuildingIds, getBuildingDataset } from "@/lib/buildings";
import { getAllPilotFaults } from "@/lib/pilot-cloud";

function formatScopeLabel(item: ClientUserAccessListItem): string {
  if (item.access.access_level === "elevator" && item.access.elevator_id) {
    return item.access.elevator_id;
  }
  return "כל הבניין";
}

export default function MasterClientAccessSection() {
  const cloudReady = isClientAccessCloudConfigured();
  const [records, setRecords] = useState<ClientUserAccessListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
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

  useEffect(() => {
    void refresh();
  }, [refresh]);

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
            NEXT_PUBLIC_SUPABASE_ANON_KEY, והריצו את migration 005.
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
    </div>
  );
}
