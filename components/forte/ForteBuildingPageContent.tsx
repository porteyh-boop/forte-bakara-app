"use client";

import { useCallback, useEffect, useState } from "react";
import PageHeader from "@/components/PageHeader";
import ForteBuildingDetailsTabContent from "@/components/forte/ForteBuildingDetailsTabContent";
import {
  getAllCloudBuildingsWithMeta,
  normalizeBuildingId,
} from "@/lib/buildings-cloud";
import { buildForteBuildingPath } from "@/lib/forte-building-routes";
import {
  checkForteMasterApiSession,
  establishForteMasterApiSession,
} from "@/lib/forte-master-api-client";
import {
  isMasterAuthenticated,
  isMasterCodeConfigured,
  isPilotCloudConfigured,
  setMasterAuthenticated,
  verifyMasterCode,
} from "@/lib/pilot-cloud";

const DETAILS_TAB_LABEL = "פרטי הבניין והתקשרות";
const CONTACTS_TAB_LABEL = "אנשי קשר";

type ForteBuildingTab = "details" | "contacts";

function MasterCodeGate({ onSuccess }: { onSuccess: () => void }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;

    if (!isMasterCodeConfigured()) {
      setError("קוד גישה לא הוגדר במערכת (NEXT_PUBLIC_MASTER_CODE).");
      return;
    }
    if (!verifyMasterCode(code)) {
      setError("קוד גישה שגוי.");
      return;
    }

    setSubmitting(true);
    setError(null);

    const sessionOk = await establishForteMasterApiSession(code);
    setSubmitting(false);

    if (!sessionOk) {
      setError("אימות שרת נכשל. נסו שוב.");
      return;
    }

    setMasterAuthenticated(true);
    onSuccess();
  }

  return (
    <div className="min-h-screen bg-gray-light flex items-center justify-center p-4">
      <form
        onSubmit={(e) => void handleSubmit(e)}
        className="w-full max-w-sm bg-white rounded-2xl border border-gray-200 p-6 shadow-sm"
      >
        <h1 className="text-lg font-bold text-navy mb-1">גישה למערכת FORTE</h1>
        <p className="text-sm text-gray-text mb-4">הזינו קוד גישה פנימי</p>
        <input
          type="password"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="קוד גישה"
          className="form-input mb-3"
          autoComplete="off"
        />
        {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
        <button type="submit" className="btn-primary w-full" disabled={submitting}>
          {submitting ? "מאמת..." : "כניסה"}
        </button>
      </form>
    </div>
  );
}

interface ForteBuildingPageContentProps {
  buildingId: string;
}

export default function ForteBuildingPageContent({
  buildingId,
}: ForteBuildingPageContentProps) {
  const normalizedBuildingId = normalizeBuildingId(buildingId);
  const [authed, setAuthed] = useState(() => isMasterAuthenticated());
  const [buildingName, setBuildingName] = useState(normalizedBuildingId);
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [activeTab, setActiveTab] = useState<ForteBuildingTab>("contacts");

  const loadBuildingMeta = useCallback(async () => {
    setLoadingMeta(true);
    if (!isPilotCloudConfigured()) {
      setBuildingName(normalizedBuildingId);
      setLoadingMeta(false);
      return;
    }

    const { rows } = await getAllCloudBuildingsWithMeta();
    const match = rows.find((row) => row.building_id === normalizedBuildingId);
    setBuildingName(match?.name ?? normalizedBuildingId);
    setLoadingMeta(false);
  }, [normalizedBuildingId]);

  useEffect(() => {
    if (!authed) return;

    let cancelled = false;

    void (async () => {
      const sessionOk = await checkForteMasterApiSession();
      if (cancelled) return;

      if (!sessionOk) {
        setMasterAuthenticated(false);
        setAuthed(false);
        return;
      }

      await loadBuildingMeta();
    })();

    return () => {
      cancelled = true;
    };
  }, [authed, loadBuildingMeta]);

  if (!authed) {
    return <MasterCodeGate onSuccess={() => setAuthed(true)} />;
  }

  return (
    <div className="min-h-screen bg-gray-light pb-8">
      <PageHeader
        title={buildingName}
        subtitle="תיק בניין — FORTE"
        master
      />

      <main className="page-content max-w-5xl mx-auto space-y-4">
        {loadingMeta ? (
          <p className="text-sm text-gray-text">טוען פרטי בניין...</p>
        ) : (
          <>
            <div className="bg-white rounded-2xl border border-gray-200 p-1">
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => setActiveTab("details")}
                  className={`flex-1 rounded-xl py-2.5 text-sm font-semibold transition-colors ${
                    activeTab === "details"
                      ? "bg-navy text-white"
                      : "bg-white border border-gray-200 text-navy"
                  }`}
                  aria-current={activeTab === "details" ? "page" : undefined}
                >
                  {DETAILS_TAB_LABEL}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("contacts")}
                  className={`flex-1 rounded-xl py-2.5 text-sm font-semibold transition-colors ${
                    activeTab === "contacts"
                      ? "bg-navy text-white"
                      : "bg-white border border-gray-200 text-navy"
                  }`}
                  aria-current={activeTab === "contacts" ? "page" : undefined}
                >
                  {CONTACTS_TAB_LABEL}
                </button>
              </div>
            </div>

            <ForteBuildingDetailsTabContent
              buildingId={normalizedBuildingId}
              activeTab={activeTab}
            />

            <p className="text-[11px] text-gray-text">
              נתיב: {buildForteBuildingPath(normalizedBuildingId)}
            </p>
          </>
        )}
      </main>
    </div>
  );
}
