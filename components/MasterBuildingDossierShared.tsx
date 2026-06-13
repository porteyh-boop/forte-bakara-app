"use client";

import Link from "next/link";
import {
  buildBuildingDossier,
  formatDossierDate,
  getHealthLevelClasses,
} from "@/lib/master-building-dossier";
import { buildMasterElevatorDossierPath } from "@/lib/master-elevator-routes";
import type { PilotCloudFault } from "@/lib/pilot-cloud";

export function DossierKpi({
  label,
  value,
  small = false,
}: {
  label: string;
  value: string | number;
  small?: boolean;
}) {
  return (
    <div className="bg-gray-light rounded-xl px-3 py-2 border border-gray-200">
      <p className="text-[11px] text-gray-text">{label}</p>
      <p
        className={`font-bold text-navy mt-0.5 ${small ? "text-xs" : "text-lg"}`}
      >
        {value}
      </p>
    </div>
  );
}

export function BuildingDossierPanel({
  dossier,
}: {
  dossier: ReturnType<typeof buildBuildingDossier>;
}) {
  const healthStyle = getHealthLevelClasses(dossier.healthLevel);

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3">
      <div>
        <h3 className="text-sm font-bold text-navy">
          תיק בניין — {dossier.buildingName}
        </h3>
        <p className="text-xs text-gray-text mt-0.5">{dossier.buildingId}</p>
      </div>

      <div
        className={`rounded-xl border p-3 ${healthStyle.bg} ${healthStyle.border}`}
      >
        <p className="text-xs font-semibold text-gray-text">ציון בריאות בניין</p>
        <p className={`text-2xl font-bold mt-0.5 ${healthStyle.text}`}>
          {dossier.healthScore}
          <span className="text-sm font-semibold mr-1">/100</span>
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
        <DossierKpi label='סה"כ תקלות' value={dossier.totalFaults} />
        <DossierKpi label="תקלות פתוחות" value={dossier.openFaults} />
        <DossierKpi label="תקלות סגורות" value={dossier.closedFaults} />
        <DossierKpi label="מספר מעליות" value={dossier.elevatorCount} />
        <DossierKpi label="תקלות חוזרות" value={dossier.recurringCount} />
        <DossierKpi
          label="תקלה אחרונה"
          value={formatDossierDate(dossier.lastFaultDate)}
          small
        />
      </div>

      {dossier.faultsByElevator.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gold mb-2">תקלות לפי מעלית</p>
          <ul className="space-y-1">
            {dossier.faultsByElevator.map((item) => (
              <li
                key={item.elevatorId}
                className="text-sm text-navy flex justify-between gap-2 border border-gray-100 rounded-lg px-2 py-1"
              >
                <span>{item.elevatorName}</span>
                <span className="font-semibold">{item.count}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function FaultHistoryTable({
  title,
  faults,
  compact = false,
}: {
  title: string;
  faults: PilotCloudFault[];
  compact?: boolean;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3">
      <h3 className="text-sm font-bold text-navy">{title}</h3>
      {faults.length === 0 ? (
        <p className="text-sm text-gray-text">אין תקלות רשומות.</p>
      ) : (
        <div className="overflow-x-auto -mx-1">
          <table className="w-full min-w-[36rem] text-sm">
            <thead>
              <tr className="text-xs text-gray-text border-b border-gray-200">
                <th className="text-right py-2 px-2 font-semibold">תאריך</th>
                <th className="text-right py-2 px-2 font-semibold">מעלית</th>
                <th className="text-right py-2 px-2 font-semibold">סוג תקלה</th>
                {!compact && (
                  <th className="text-right py-2 px-2 font-semibold">תיאור</th>
                )}
                <th className="text-right py-2 px-2 font-semibold">סטטוס</th>
              </tr>
            </thead>
            <tbody>
              {faults.map((f) => (
                <tr key={f.id} className="border-b border-gray-100 align-top">
                  <td className="py-2 px-2 whitespace-nowrap text-xs">
                    {formatDossierDate(f.created_at)}
                  </td>
                  <td className="py-2 px-2 text-xs">{f.elevator_name}</td>
                  <td className="py-2 px-2 text-xs">{f.fault_type}</td>
                  {!compact && (
                    <td className="py-2 px-2 text-xs text-navy/80 max-w-[12rem]">
                      {f.description}
                    </td>
                  )}
                  <td className="py-2 px-2 text-xs font-semibold">{f.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function ElevatorDossierLink({
  buildingId,
  elevatorId,
}: {
  buildingId: string;
  elevatorId: string;
}) {
  const href = buildMasterElevatorDossierPath(buildingId, elevatorId);

  return (
    <Link
      href={href}
      className="mt-1.5 inline-flex text-xs font-semibold text-gold hover:underline cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-gold rounded"
    >
      לחצו לצפייה בתיק המעלית
    </Link>
  );
}
