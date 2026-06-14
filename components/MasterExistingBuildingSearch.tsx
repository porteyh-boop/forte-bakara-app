"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { buildMasterBuildingDossierPath } from "@/lib/master-building-routes";
import type { MasterBuildingEntry } from "@/lib/master-buildings-list";
import {
  searchMasterBuildings,
  type MasterBuildingSearchHit,
  type MasterBuildingSearchProfile,
} from "@/lib/master-building-search";

function formatValue(value: string | null | undefined): string {
  return value?.trim() ? value.trim() : "—";
}

export function MasterBuildingProfileCard({
  profile,
  compact = false,
}: {
  profile: MasterBuildingSearchProfile;
  compact?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border border-gold/30 bg-gold/5 ${
        compact ? "p-2.5 space-y-1" : "p-3 space-y-1.5"
      }`}
    >
      <p className={`font-semibold text-navy ${compact ? "text-sm" : "text-base"}`}>
        {profile.name}
      </p>
      <p className="text-xs text-gray-text" dir="ltr">
        {profile.buildingId}
      </p>
      <dl className={`grid gap-1 ${compact ? "text-xs" : "text-sm"}`}>
        <div className="flex flex-wrap gap-x-2">
          <dt className="text-gray-text">כתובת:</dt>
          <dd className="text-navy font-medium">
            {formatValue(profile.address)}
            {profile.city ? `, ${profile.city}` : ""}
          </dd>
        </div>
        <div className="flex flex-wrap gap-x-2">
          <dt className="text-gray-text">חברת ניהול של הבניין:</dt>
          <dd className="text-navy font-medium">
            {formatValue(profile.managementCompany)}
          </dd>
        </div>
        <div className="flex flex-wrap gap-x-2">
          <dt className="text-gray-text">חברת מעליות:</dt>
          <dd className="text-navy font-medium">
            {formatValue(profile.elevatorCompany)}
          </dd>
        </div>
        <div className="flex flex-wrap gap-x-2">
          <dt className="text-gray-text">מספר מעליות:</dt>
          <dd className="text-navy font-medium">{profile.elevatorCount}</dd>
        </div>
      </dl>
    </div>
  );
}

export type MasterExistingBuildingSearchMode = "prevent-duplicate" | "select";

interface MasterExistingBuildingSearchProps {
  entries: MasterBuildingEntry[];
  resolveElevatorCount: (buildingId: string) => number;
  selectedHit: MasterBuildingSearchHit | null;
  onSelectHit: (hit: MasterBuildingSearchHit | null) => void;
  onShowInList?: (buildingId: string) => void;
  mode?: MasterExistingBuildingSearchMode;
}

export default function MasterExistingBuildingSearch({
  entries,
  resolveElevatorCount,
  selectedHit,
  onSelectHit,
  onShowInList,
  mode = "prevent-duplicate",
}: MasterExistingBuildingSearchProps) {
  const router = useRouter();
  const isSelectMode = mode === "select";
  const [query, setQuery] = useState("");
  const [focusedResultIndex, setFocusedResultIndex] = useState(0);

  const results = useMemo(
    () => searchMasterBuildings(entries, query, resolveElevatorCount),
    [entries, query, resolveElevatorCount]
  );

  useEffect(() => {
    setFocusedResultIndex(0);
  }, [results]);

  function openBuildingDossier(buildingId: string) {
    router.push(buildMasterBuildingDossierPath(buildingId));
  }

  function resolveEnterTargetHit(): MasterBuildingSearchHit | null {
    if (selectedHit) return selectedHit;
    if (!query.trim() || results.length === 0) return null;
    return results[Math.min(focusedResultIndex, results.length - 1)] ?? results[0];
  }

  function handleSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter" || isSelectMode) return;

    const targetHit = resolveEnterTargetHit();
    if (!targetHit) return;

    e.preventDefault();
    openBuildingDossier(targetHit.profile.buildingId);
  }

  function handleQueryChange(value: string) {
    setQuery(value);
    if (selectedHit) {
      onSelectHit(null);
    }
  }

  function handleSelect(hit: MasterBuildingSearchHit) {
    onSelectHit(hit);
    setQuery(hit.profile.name);
  }

  function handleClearSelection() {
    onSelectHit(null);
    setQuery("");
  }

  return (
    <div className="rounded-xl border border-navy/15 bg-gray-light/60 p-3 space-y-3">
      <div>
        <h4 className="text-sm font-bold text-navy">
          {isSelectMode ? "בחירת בניין" : "חיפוש בניין קיים"}
        </h4>
        <p className="text-xs text-gray-text mt-0.5">
          {isSelectMode
            ? "חפשו לפי שם בניין, כתובת, עיר או מזהה בניין לשיוך המסמך."
            : "חפשו לפי שם בניין, כתובת, עיר או מזהה בניין לפני יצירת רשומה חדשה."}
        </p>
      </div>

      <label className="block">
        <span className="text-xs text-gray-text">חיפוש</span>
        <input
          className="form-input mt-1"
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
          onKeyDown={handleSearchKeyDown}
          placeholder="לדוגמה: אורן, הרצל 12, תל אביב, md25"
          disabled={Boolean(selectedHit)}
        />
      </label>

      {selectedHit ? (
        <div className="space-y-3">
          <p
            className={`text-sm font-semibold rounded-xl px-3 py-2 ${
              isSelectMode
                ? "text-emerald-900 bg-emerald-50 border border-emerald-200"
                : "text-amber-900 bg-amber-50 border border-amber-200"
            }`}
          >
            {isSelectMode ? "בניין נבחר למסמך" : "הבניין כבר קיים במערכת"}
          </p>
          <MasterBuildingProfileCard profile={selectedHit.profile} />
          <div className="flex flex-wrap gap-2">
            {!isSelectMode && (
              <>
                <Link
                  href={buildMasterBuildingDossierPath(selectedHit.profile.buildingId)}
                  className="text-sm font-semibold bg-navy text-white px-4 py-2 rounded-xl"
                >
                  פתח תיק בניין
                </Link>
                {onShowInList && (
                  <button
                    type="button"
                    onClick={() => onShowInList(selectedHit.profile.buildingId)}
                    className="text-sm font-semibold rounded-xl border border-gray-200 px-4 py-2"
                  >
                    הצג בניהול בניינים
                  </button>
                )}
              </>
            )}
            <button
              type="button"
              onClick={handleClearSelection}
              className="text-sm font-semibold rounded-xl border border-gray-200 px-4 py-2"
            >
              {isSelectMode ? "בחר בניין אחר" : "חיפוש מחדש"}
            </button>
          </div>
        </div>
      ) : (
        <>
          {query.trim() && results.length === 0 && (
            <p className="text-sm text-gray-text bg-white border border-gray-200 rounded-xl px-3 py-2">
              {isSelectMode
                ? "לא נמצא בניין תואם. נסו חיפוש אחר."
                : "לא נמצא בניין תואם. ניתן להמשיך ליצירת בניין חדש למטה."}
            </p>
          )}

          {results.length > 0 && (
            <ul className="space-y-2 max-h-64 overflow-y-auto">
              {results.map((hit, index) => (
                <li key={hit.entry.buildingId}>
                  <div
                    className={`rounded-xl border bg-white px-3 py-2 transition-colors ${
                      index === focusedResultIndex
                        ? "border-navy/50 bg-gray-50"
                        : "border-gray-200"
                    }`}
                    onMouseEnter={() => setFocusedResultIndex(index)}
                  >
                    <button
                      type="button"
                      onClick={() => handleSelect(hit)}
                      className="w-full text-right hover:bg-transparent"
                    >
                      <MasterBuildingProfileCard profile={hit.profile} compact />
                    </button>
                    {!isSelectMode && (
                      <div className="mt-2 flex justify-end">
                        <Link
                          href={buildMasterBuildingDossierPath(hit.profile.buildingId)}
                          className="text-sm font-semibold bg-navy text-white px-4 py-2 rounded-xl"
                          onClick={(e) => e.stopPropagation()}
                        >
                          פתח תיק בניין
                        </Link>
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
