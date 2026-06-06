import BuildingDetailRow from "@/components/BuildingDetailRow";
import ElevatorStatusRow from "@/components/ElevatorStatusRow";
import PageHeader from "@/components/PageHeader";
import SectionTitle from "@/components/SectionTitle";
import StatusBadge from "@/components/StatusBadge";
import { building, elevators } from "@/lib/data";

export default function BuildingPage() {
  const phoneHref = `tel:${building.phone.replace(/-/g, "")}`;

  return (
    <div className="min-h-screen bg-gray-light">
      <PageHeader
        title="פרטי בניין"
        subtitle={building.managementCompany}
        badge="ניהול נכסים"
      />

      <main className="page-content -mt-2">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden mb-5 animate-fade-up">
          <div className="h-1.5 bg-gradient-to-l from-gold via-gold/60 to-navy" />
          <div className="p-5">
            <h2 className="text-xl font-bold text-navy">{building.name}</h2>
            <p className="text-sm text-gray-text mt-1">
              {building.address}, {building.city}
            </p>
            <div className="flex items-center gap-3 mt-4">
              <div className="flex items-center gap-1.5 text-sm">
                <span className="font-bold text-navy">{building.units}</span>
                <span className="text-gray-text">יחידות</span>
              </div>
              <div className="w-px h-4 bg-gray-200" />
              <div className="flex items-center gap-1.5 text-sm">
                <span className="font-bold text-navy">{building.elevatorCount}</span>
                <span className="text-gray-text">מעליות</span>
              </div>
              <StatusBadge
                status={
                  elevators.some((e) => e.status === "מושבתת")
                    ? "מושבתת"
                    : elevators.some((e) => e.status === "בטיפול")
                      ? "בטיפול"
                      : "פעילה"
                }
                size="md"
              />
            </div>
          </div>
        </div>

        <section className="mb-5">
          <SectionTitle title="פרטי קשר" />
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-5 animate-fade-up animation-delay-100">
            <BuildingDetailRow
              label="חברת מעליות"
              value={building.elevatorCompany}
              icon={
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0H5m14 0h2m-16 0H3" />
                </svg>
              }
            />
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
            <BuildingDetailRow
              label="חברת ניהול"
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
          <SectionTitle title="מעליות בבניין" />
          <ElevatorStatusRow elevators={elevators} />
        </section>

        <a
          href={phoneHref}
          className="btn-primary flex items-center justify-center gap-2 animate-fade-up animation-delay-200"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
          </svg>
          התקשרות לחברת המעליות
        </a>
      </main>
    </div>
  );
}
