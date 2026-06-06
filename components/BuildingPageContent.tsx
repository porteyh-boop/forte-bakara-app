"use client";

import { useMemo } from "react";
import BuildingDetailRow from "@/components/BuildingDetailRow";
import ElevatorStatusRow from "@/components/ElevatorStatusRow";
import PageHeader from "@/components/PageHeader";
import SectionTitle from "@/components/SectionTitle";
import StatusBadge from "@/components/StatusBadge";
import { isClosedFault, isOpenFault } from "@/lib/fault-lifecycle";
import { useBuilding } from "@/components/BuildingProvider";
import { useRuntimeBuildingContext } from "@/hooks/useRuntimeBuildingContext";
import { getAllElevatorFaultCounts } from "@/lib/elevator-stats";

export default function BuildingPageContent() {
  const { ctx } = useBuilding();
  const { elevators: effectiveElevators, faults, ready } =
    useRuntimeBuildingContext();
  const { building } = ctx;
  const phoneHref =
    building.phone === "דמו"
      ? undefined
      : `tel:${building.phone.replace(/-/g, "")}`;

  const buildingStatus = useMemo(() => {
    if (effectiveElevators.some((e) => e.status === "מושבתת")) return "מושבתת";
    if (effectiveElevators.some((e) => e.status === "בטיפול")) return "בטיפול";
    return "פעילה";
  }, [effectiveElevators]);

  const faultCounts = useMemo(
    () => getAllElevatorFaultCounts(effectiveElevators, faults),
    [effectiveElevators, faults]
  );

  const openFaults = faults.filter((f) => isOpenFault(f)).length;
  const closedFaults = faults.filter((f) => isClosedFault(f)).length;

  if (!ready) {
    return (
      <div className="min-h-screen bg-gray-light">
        <PageHeader
          title="פרטי בניין"
          subtitle={building.managementCompany}
          badge={building.buildingCode}
        />
        <main className="page-content -mt-2">
          <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center animate-pulse">
            <p className="text-sm text-gray-text">טוען פרטי בניין...</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-light">
      <PageHeader
        title="פרטי בניין"
        subtitle={building.managementCompany}
        badge={building.buildingCode}
      />

      <main className="page-content -mt-2">
        <section className="mb-5">
          <SectionTitle title="סיכום הבניין" />
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden animate-fade-up">
            <div className="h-1.5 bg-gradient-to-l from-gold via-gold/60 to-navy" />
            <div className="p-5">
              <h2 className="text-xl font-bold text-navy">{building.name}</h2>
              <p className="text-sm text-gray-text mt-1">
                {building.address}, {building.city}
              </p>
              <div className="flex flex-wrap items-center gap-3 mt-4">
                <div className="flex items-center gap-1.5 text-sm">
                  <span className="font-bold text-navy">{building.buildingCode}</span>
                  <span className="text-gray-text">קוד בניין</span>
                </div>
                <div className="w-px h-4 bg-gray-200" />
                <div className="flex items-center gap-1.5 text-sm">
                  <span className="font-bold text-navy">{building.elevatorCount}</span>
                  <span className="text-gray-text">מעליות</span>
                </div>
                <div className="w-px h-4 bg-gray-200" />
                <div className="flex items-center gap-1.5 text-sm">
                  <span className="font-bold text-amber-700">{openFaults}</span>
                  <span className="text-gray-text">תקלות פתוחות</span>
                </div>
                <div className="w-px h-4 bg-gray-200" />
                <div className="flex items-center gap-1.5 text-sm">
                  <span className="font-bold text-navy">{closedFaults}</span>
                  <span className="text-gray-text">תקלות סגורות</span>
                </div>
                <StatusBadge status={buildingStatus} size="md" />
              </div>
            </div>
          </div>
        </section>

        <section className="mb-5">
          <SectionTitle title="פרטי קשר" />
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-5 animate-fade-up animation-delay-100">
            <BuildingDetailRow
              label="איש קשר"
              value={building.contactPerson}
              icon={
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              }
            />
            <BuildingDetailRow
              label="טלפון"
              value={building.phone}
              href={phoneHref}
              icon={
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
              }
            />
          </div>
        </section>

        <section className="mb-5">
          <SectionTitle title="חברת המעליות" />
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-5 animate-fade-up animation-delay-100">
            <BuildingDetailRow
              label="ספק שירות"
              value={building.elevatorCompany}
              icon={
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0H5m14 0h2m-16 0H3" />
                </svg>
              }
            />
          </div>
        </section>

        <section className="mb-5">
          <SectionTitle title="חברת הניהול" />
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-5 animate-fade-up animation-delay-100">
            <BuildingDetailRow
              label="ניהול נכסים"
              value={building.managementCompany}
              icon={
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              }
            />
          </div>
        </section>

        <section className="mb-6">
          <SectionTitle title="רשימת מעליות" />
          <ElevatorStatusRow
            elevators={effectiveElevators}
            faultCounts={faultCounts}
          />
        </section>

        {phoneHref && (
          <a
            href={phoneHref}
            className="btn-primary flex items-center justify-center gap-2 animate-fade-up animation-delay-200"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
            התקשרות לחברת המעליות
          </a>
        )}
      </main>
    </div>
  );
}
