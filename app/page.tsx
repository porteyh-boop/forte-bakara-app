import Link from "next/link";
import OperationalCharts from "@/components/client/OperationalCharts";
import MonthlyOperationalReport from "@/components/client/MonthlyOperationalReport";
import BuildingCard from "@/components/BuildingCard";
import ElevatorStatusRow from "@/components/ElevatorStatusRow";
import FaultCard from "@/components/FaultCard";
import InfoCard from "@/components/InfoCard";
import PageHeader from "@/components/PageHeader";
import SectionTitle from "@/components/SectionTitle";
import {
  building,
  elevators,
  getClientStats,
  getFaultsByType,
  getMonthlyFaultTrend,
  getMonthlyOperationalReport,
  getOpenFaults,
} from "@/lib/data";
import { BRAND_EDITOR_FULL, BRAND_TAGLINE } from "@/lib/brand";

export default function HomePage() {
  const stats = getClientStats();
  const openFaults = getOpenFaults();
  const monthlyReport = getMonthlyOperationalReport();

  return (
    <div className="min-h-screen bg-gray-light">
      <PageHeader
        title="פורטה בקרה"
        subtitle={`${BRAND_TAGLINE} · ${BRAND_EDITOR_FULL}`}
        badge="תצוגת לקוח"
      />

      <main className="page-content -mt-2">
        <div className="mb-5">
          <BuildingCard building={building} elevators={elevators} />
        </div>

        <div className="grid grid-cols-2 gap-3 mb-6">
          <InfoCard
            label="מספר תקלות"
            value={stats.totalFaults}
            delay={50}
            icon={
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            }
          />
          <InfoCard
            label="תקלות פתוחות"
            value={stats.openFaults}
            accent
            delay={100}
            icon={
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
            }
          />
          <InfoCard
            label="תקלות סגורות"
            value={stats.closedFaults}
            delay={150}
            icon={
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
          />
          <InfoCard
            label="זמינות מעליות"
            value={`${stats.availability}%`}
            delay={200}
            icon={
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            }
          />
        </div>

        <section className="mb-6">
          <SectionTitle title="סטטוס מעליות" />
          <ElevatorStatusRow elevators={elevators} />
        </section>

        <section className="mb-6">
          <SectionTitle
            title="תקלות פתוחות"
            action={{ label: "היסטוריית דיווחים", href: "/history" }}
          />
          {openFaults.length > 0 ? (
            <div className="flex flex-col gap-3">
              {openFaults.map((fault, i) => (
                <FaultCard key={fault.id} fault={fault} compact index={i} />
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center animate-fade-up">
              <p className="text-sm font-medium text-navy">אין תקלות פתוחות</p>
              <p className="text-xs text-gray-text mt-1">כל המעליות פועלות כשורה</p>
            </div>
          )}
        </section>

        <section className="mb-6">
          <SectionTitle title="גרפים תפעוליים" />
          <OperationalCharts
            faultsByType={getFaultsByType().map((f) => ({
              label: f.type,
              count: f.count,
            }))}
            monthlyTrend={getMonthlyFaultTrend()}
          />
        </section>

        <section className="mb-6">
          <MonthlyOperationalReport report={monthlyReport} />
        </section>

        <Link href="/report" className="btn-gold animate-fade-up animation-delay-200">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          דיווח תקלה חדשה
        </Link>
      </main>
    </div>
  );
}
