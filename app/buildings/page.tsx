"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import { useBuilding } from "@/components/BuildingProvider";
import { useAllBuildingsLiveList } from "@/hooks/useAllBuildingsLiveList";
import { APP_ROLE } from "@/lib/config";
import {
  FEEDBACK_RESET_CONFIRM_ALL,
  FEEDBACK_RESET_CONFIRM_BUILDING,
  FEEDBACK_RESET_SUCCESS_MESSAGE,
  clearAllFeedback,
  clearFeedbackByBuilding,
  notifyFeedbackUpdated,
} from "@/lib/feedback-storage";
import {
  PILOT_RESET_CONFIRM_ALL,
  PILOT_RESET_CONFIRM_BUILDING,
  PILOT_RESET_SUCCESS_MESSAGE,
  resetAllPilotData,
  resetBuildingPilotData,
  shouldShowPilotResetControls,
} from "@/lib/pilot-reset";
import type { BuildingListItem } from "@/lib/types";

function RoleDebugBadge() {
  return (
    <span
      className={`fixed top-2 left-2 z-50 rounded-md px-2 py-1 text-[10px] font-mono font-semibold shadow-sm border ${
        APP_ROLE === "expert"
          ? "bg-amber-100 text-amber-900 border-amber-300"
          : "bg-slate-100 text-slate-700 border-slate-300"
      }`}
      aria-label={`תפקיד פעיל: ${APP_ROLE}`}
    >
      Role: {APP_ROLE}
    </span>
  );
}

function toneClasses(tone: BuildingListItem["statusTone"]) {
  switch (tone) {
    case "alert":
      return "border-red-200 bg-red-50/50";
    case "warning":
      return "border-amber-200 bg-amber-50/50";
    default:
      return "border-gray-200";
  }
}

export default function BuildingsPage() {
  const router = useRouter();
  const { buildingId, selectBuilding, ctx } = useBuilding();
  const { buildings, ready, refresh } = useAllBuildingsLiveList();
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const showResetControls = shouldShowPilotResetControls();

  function handleSelect(id: string) {
    selectBuilding(id);
    router.push("/");
  }

  function showSuccessThenReload() {
    setSuccessMessage(PILOT_RESET_SUCCESS_MESSAGE);
    setTimeout(() => window.location.reload(), 1200);
  }

  function handleResetAll() {
    if (!window.confirm(PILOT_RESET_CONFIRM_ALL)) return;
    if (resetAllPilotData()) {
      showSuccessThenReload();
    }
  }

  function handleResetSelectedBuilding() {
    if (!window.confirm(PILOT_RESET_CONFIRM_BUILDING)) return;
    if (resetBuildingPilotData(buildingId)) {
      refresh();
      showSuccessThenReload();
    }
  }

  function handleResetAllFeedback() {
    if (!window.confirm(FEEDBACK_RESET_CONFIRM_ALL)) return;
    if (clearAllFeedback()) {
      notifyFeedbackUpdated();
      setSuccessMessage(FEEDBACK_RESET_SUCCESS_MESSAGE);
      setTimeout(() => window.location.reload(), 1200);
    }
  }

  function handleResetBuildingFeedback() {
    if (!window.confirm(FEEDBACK_RESET_CONFIRM_BUILDING)) return;
    if (clearFeedbackByBuilding(buildingId)) {
      notifyFeedbackUpdated(buildingId);
      setSuccessMessage(FEEDBACK_RESET_SUCCESS_MESSAGE);
      setTimeout(() => window.location.reload(), 1200);
    }
  }

  if (!ready) {
    return (
      <div className="min-h-screen bg-gray-light">
        <RoleDebugBadge />
        <PageHeader
          title="בחירת בניין"
          subtitle="טוען נתוני בניינים..."
          badge="הדגמה"
        />
        <main className="page-content -mt-2">
          <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center animate-pulse">
            <p className="text-sm text-gray-text">טוען סטטוס חי לכל הבניינים...</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-light">
      <RoleDebugBadge />
      <PageHeader
        title="בחירת בניין"
        subtitle="סטטוס חי לכל הבניינים — מתעדכן לפי דיווחים וסגירות"
        badge="הדגמה"
      />

      <main className="page-content -mt-2">
        <p className="text-sm text-gray-text mb-4 animate-fade-up">
          כל כרטיס מציג נתונים מעודכנים: תקלות פתוחות, מעליות מושבתות וסטטוס כללי.
        </p>

        {successMessage && (
          <div
            className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800 animate-fade-up"
            role="status"
          >
            {successMessage}
          </div>
        )}

        <div className="flex flex-col gap-3">
          {buildings.map((item, i) => {
            const isActive = item.id === buildingId;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelect(item.id)}
                className={`w-full text-right bg-white rounded-2xl border shadow-sm overflow-hidden animate-fade-up transition-all duration-200 hover:shadow-md active:scale-[0.99] ${toneClasses(item.statusTone)} ${
                  isActive ? "ring-2 ring-gold border-gold/50" : ""
                }`}
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <div className="h-1 bg-gradient-to-l from-gold via-gold/60 to-navy" />
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-semibold text-gold tracking-wide mb-0.5">
                        {item.buildingCode}
                      </p>
                      <h3 className="text-lg font-bold text-navy">{item.name}</h3>
                      <p className="text-sm text-gray-text mt-0.5">
                        {item.address}, {item.city}
                      </p>
                    </div>
                    <StatusBadge
                      status={item.buildingStatus}
                      size="sm"
                      pulse={item.buildingStatus === "מושבתת"}
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 pt-3 border-t border-gray-100 text-sm">
                    <span>
                      <strong className="text-navy">{item.elevatorCount}</strong>
                      <span className="text-gray-text mr-1"> מעליות</span>
                    </span>
                    <span className="w-px h-4 bg-gray-200 hidden sm:block" />
                    <span>
                      <strong className="text-navy">{item.openFaultCount}</strong>
                      <span className="text-gray-text mr-1"> פתוחות</span>
                    </span>
                    <span className="w-px h-4 bg-gray-200 hidden sm:block" />
                    <span>
                      <strong className="text-navy">{item.closedFaultCount}</strong>
                      <span className="text-gray-text mr-1"> סגורות</span>
                    </span>
                    {item.disabledElevatorCount > 0 && (
                      <>
                        <span className="w-px h-4 bg-gray-200 hidden sm:block" />
                        <span className="text-red-600 font-medium">
                          {item.disabledElevatorCount} מושבתות
                        </span>
                      </>
                    )}
                  </div>

                  <p className="text-xs text-navy/60 mt-2">{item.statusLabel}</p>

                  {isActive && (
                    <p className="text-xs font-semibold text-gold mt-2">
                      ✓ בניין פעיל כעת
                    </p>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {showResetControls && (
          <section className="mt-8 pt-6 border-t border-gray-200 animate-fade-up">
            <p className="text-xs font-semibold text-navy/60 mb-3">
              כלי מומחה — איפוס נתוני פיילוט
            </p>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={handleResetAll}
                className="w-full rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 hover:bg-red-100 transition-colors"
              >
                איפוס נתוני בדיקה
              </button>
              <button
                type="button"
                onClick={handleResetSelectedBuilding}
                className="w-full rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800 hover:bg-amber-100 transition-colors"
              >
                איפוס נתוני הבניין הנבחר ({ctx.building.buildingCode})
              </button>
              <button
                type="button"
                onClick={handleResetAllFeedback}
                className="w-full rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 hover:bg-red-100 transition-colors"
              >
                איפוס כל המשובים
              </button>
              <button
                type="button"
                onClick={handleResetBuildingFeedback}
                className="w-full rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800 hover:bg-amber-100 transition-colors"
              >
                איפוס משובים לבניין הנבחר ({ctx.building.buildingCode})
              </button>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
