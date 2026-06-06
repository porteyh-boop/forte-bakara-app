"use client";

import { useMemo } from "react";
import PageHeader from "@/components/PageHeader";
import ExpertInsightCard from "@/components/expert/ExpertInsightCard";
import ExpertMetricCard from "@/components/expert/ExpertMetricCard";
import ExpertSection from "@/components/expert/ExpertSection";
import ExpertPrintLink from "@/components/expert/ExpertPrintLink";
import InternalBadge from "@/components/expert/InternalBadge";
import { useBuilding } from "@/components/BuildingProvider";
import { useRuntimeBuildingContext } from "@/hooks/useRuntimeBuildingContext";
import ExpertFeedbackSection from "@/components/expert/ExpertFeedbackSection";
import ExpertLifecycleStats from "@/components/expert/ExpertLifecycleStats";
import { getExpertAnalytics } from "@/lib/analytics";
import { BRAND_EDITOR_FULL } from "@/lib/brand";
import { getFaultLifecycleStats } from "@/lib/fault-stats";

export default function ExpertPageContent() {
  const { ctx } = useBuilding();
  const runtimeCtx = useRuntimeBuildingContext();
  const analytics = useMemo(() => getExpertAnalytics(runtimeCtx), [runtimeCtx]);
  const lifecycleStats = useMemo(
    () => getFaultLifecycleStats(runtimeCtx, runtimeCtx.faults),
    [runtimeCtx]
  );

  return (
    <div className="min-h-screen bg-gray-light">
      <PageHeader
        title="מסך מומחה"
        subtitle={`תובנות פנימיות · ${BRAND_EDITOR_FULL} · ${ctx.building.name}`}
        badge="מנוע ניתוח"
      />

      <main className="page-content -mt-2">
        <div className="mb-5">
          <InternalBadge />
        </div>

        <ExpertPrintLink />

        <ExpertFeedbackSection />

        <ExpertSection title="מחזור חיים וסטטיסטיקות">
          <ExpertLifecycleStats stats={lifecycleStats} />
        </ExpertSection>

        {analytics.alerts.length > 0 && (
          <ExpertSection title="התראות על חריגה">
            <div className="flex flex-col gap-2">
              {analytics.alerts.map((alert, i) => (
                <div
                  key={alert.id}
                  className={`rounded-xl border px-4 py-3 text-sm animate-fade-up ${
                    alert.severity === "גבוה"
                      ? "bg-red-50 border-red-200 text-red-800"
                      : "bg-amber-50 border-amber-200 text-amber-800"
                  }`}
                  style={{ animationDelay: `${i * 50}ms` }}
                >
                  {alert.message}
                </div>
              ))}
            </div>
          </ExpertSection>
        )}

        <div className="grid grid-cols-2 gap-3 mb-5">
          {analytics.metrics.map((metric, i) => (
            <ExpertMetricCard key={metric.label} metric={metric} index={i} />
          ))}
        </div>

        <ExpertSection title="מגמת שיפור / החמרה">
          <div
            className={`rounded-2xl border p-4 shadow-sm ${
              analytics.trend.direction === "החמרה"
                ? "bg-red-50 border-red-200"
                : analytics.trend.direction === "שיפור"
                  ? "bg-emerald-50 border-emerald-200"
                  : "bg-white border-gray-200"
            }`}
          >
            <p className="text-sm font-bold text-navy mb-1">
              {analytics.trend.direction}
            </p>
            <p className="text-sm text-navy/80 leading-relaxed">
              {analytics.trend.description}
            </p>
            <div className="flex gap-4 mt-2 text-xs text-gray-text">
              <span>תקלות: {analytics.trend.faultCountChangePercent > 0 ? "+" : ""}{analytics.trend.faultCountChangePercent}%</span>
              <span>השבתה: {analytics.trend.downtimeChangePercent > 0 ? "+" : ""}{analytics.trend.downtimeChangePercent}%</span>
            </div>
          </div>
        </ExpertSection>

        <ExpertSection title="תובנות מחושבות">
          <div className="flex flex-col gap-3">
            {analytics.insights.map((insight, i) => (
              <ExpertInsightCard key={insight.id} insight={insight} index={i} />
            ))}
          </div>
        </ExpertSection>

        <ExpertSection title="תקלות חוזרות לפי מעלית">
          <div className="bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100 shadow-sm">
            {analytics.recurringByElevator.map((item) => (
              <div key={item.elevatorId} className="px-4 py-3.5">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-navy">{item.elevatorName}</p>
                  <span className="text-xs font-bold text-navy">{item.percentage}%</span>
                </div>
                <p className="text-xs text-gray-text mt-0.5">
                  {item.faultCount} תקלות
                  {item.isRecurring && " · חזרתיות מזוהה"}
                </p>
                {item.topTypes.length > 0 && (
                  <p className="text-xs text-navy/70 mt-1">
                    סוגים עיקריים: {item.topTypes.map((t) => `${t.type} (${t.count})`).join(", ")}
                  </p>
                )}
              </div>
            ))}
          </div>
        </ExpertSection>

        <ExpertSection title="תקלות חוזרות לפי סוג">
          <div className="bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100 shadow-sm">
            {analytics.recurringByType.map((item) => (
              <div key={item.type} className="px-4 py-3.5">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-navy">{item.type}</p>
                  <span className="text-xs font-bold text-navy">{item.percentage}%</span>
                </div>
                <p className="text-xs text-gray-text mt-0.5">
                  {item.count} מקרים · {item.elevators.join(", ")}
                  {item.isRecurring && (
                    <span className="text-red-600 font-medium"> · חוזר</span>
                  )}
                </p>
              </div>
            ))}
          </div>
        </ExpertSection>

        {analytics.failurePatterns.length > 0 && (
          <ExpertSection title="זיהוי דפוסי כשל">
            <div className="flex flex-col gap-2">
              {analytics.failurePatterns.map((pattern) => (
                <div
                  key={pattern}
                  className="bg-white rounded-2xl border border-red-200 p-4 shadow-sm ring-1 ring-red-100"
                >
                  <p className="text-sm text-navy leading-relaxed">{pattern}</p>
                </div>
              ))}
            </div>
          </ExpertSection>
        )}

        <ExpertSection title="חלוקה לפי סוגי תקלות">
          <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
            {analytics.faultTypeBreakdown.map((item) => (
              <div key={item.type} className="mb-3 last:mb-0">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-navy/80">{item.type}</span>
                  <span className="font-semibold text-navy">
                    {item.count} ({item.percentage}%)
                  </span>
                </div>
                <div className="h-1.5 bg-gray-light rounded-full overflow-hidden">
                  <div
                    className="h-full bg-navy rounded-full"
                    style={{ width: `${item.percentage}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </ExpertSection>

        <ExpertSection title="זמינות לפי מעלית">
          <div className="bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100 shadow-sm">
            {analytics.elevatorAvailability.map((item) => (
              <div key={item.elevatorId} className="px-4 py-3.5">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-navy">{item.elevatorName}</p>
                  <span
                    className={`text-sm font-bold ${
                      item.availabilityPercent >= 95
                        ? "text-emerald-600"
                        : item.availabilityPercent >= 85
                          ? "text-amber-600"
                          : "text-red-600"
                    }`}
                  >
                    {item.availabilityPercent}%
                  </span>
                </div>
                <p className="text-xs text-gray-text mt-0.5">
                  {item.faultCount} תקלות · {item.downtimeHours} שעות השבתה
                </p>
              </div>
            ))}
          </div>
        </ExpertSection>

        <ExpertSection title="מעלית בעייתית">
          <div className="bg-white rounded-2xl border border-amber-200 p-4 shadow-sm">
            <p className="text-lg font-bold text-navy">
              {analytics.problematicElevator.name}
            </p>
            <div className="flex gap-4 mt-2 text-sm">
              <span>
                <strong>{analytics.problematicElevator.faultCount}</strong> תקלות
              </span>
              <span>
                <strong>{analytics.problematicElevator.percentage}%</strong> מסך הכל
              </span>
              <span>
                <strong>{analytics.problematicElevator.downtimeHours}</strong> שעות השבתה
              </span>
            </div>
            <p className="text-xs text-amber-700 mt-2 font-medium">
              {analytics.problematicElevator.reason}
            </p>
          </div>
        </ExpertSection>

        {analytics.insufficientTreatment.suspiciousCases > 0 && (
          <ExpertSection title="חשד לטיפול לא מספק">
            <div className="bg-white rounded-2xl border border-red-200 p-4 shadow-sm">
              <p className="text-sm font-semibold text-navy">
                {analytics.insufficientTreatment.company}
              </p>
              <p className="text-xs text-red-600 font-medium mt-1">
                {analytics.insufficientTreatment.suspiciousCases} מקרים חשודים
              </p>
              <p className="text-sm text-navy/75 mt-2 leading-relaxed">
                {analytics.insufficientTreatment.detail}
              </p>
            </div>
          </ExpertSection>
        )}

        <ExpertSection title="ניתוח זמני תגובה">
          <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-gray-text">ממוצע</p>
              <p className="font-bold text-navy">{analytics.responseTime.averageHours} שעות</p>
            </div>
            <div>
              <p className="text-xs text-gray-text">יעד</p>
              <p className="font-bold text-emerald-600">{analytics.responseTime.targetHours} שעות</p>
            </div>
            <div>
              <p className="text-xs text-gray-text">עמידה ביעד</p>
              <p className="font-bold text-red-600">{analytics.responseTime.compliancePercent}%</p>
            </div>
            <div>
              <p className="text-xs text-gray-text">מגמה</p>
              <p className={`font-bold ${analytics.responseTime.trendPercent > 0 ? "text-red-600" : "text-emerald-600"}`}>
                {analytics.responseTime.trendPercent > 0 ? "+" : ""}{analytics.responseTime.trendPercent}%
              </p>
            </div>
            <div className="col-span-2">
              <p className="text-xs text-gray-text">מקרה גרוע ביותר</p>
              <p className="font-medium text-navy text-xs mt-0.5">
                {analytics.responseTime.worstCase}
              </p>
            </div>
          </div>
        </ExpertSection>

        <ExpertSection title="ניתוח זמני השבתה">
          <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
            <div className="grid grid-cols-2 gap-3 text-sm mb-3">
              <div>
                <p className="text-xs text-gray-text">ממוצע</p>
                <p className="font-bold text-navy">{analytics.downtime.averageHours} שעות</p>
              </div>
              <div>
                <p className="text-xs text-gray-text">סה״כ</p>
                <p className="font-bold text-navy">{analytics.downtime.totalHours} שעות</p>
              </div>
              <div>
                <p className="text-xs text-gray-text">החודש</p>
                <p className="font-bold text-red-600">{analytics.downtime.monthHours} שעות</p>
              </div>
              <div>
                <p className="text-xs text-gray-text">מגמה</p>
                <p className={`font-bold ${analytics.downtime.trendPercent > 0 ? "text-red-600" : "text-emerald-600"}`}>
                  {analytics.downtime.trendPercent > 0 ? "+" : ""}{analytics.downtime.trendPercent}%
                </p>
              </div>
            </div>
            <p className="text-xs text-gray-text">
              אירוע ארוך ביותר: {analytics.downtime.longestEvent}
            </p>
          </div>
        </ExpertSection>

        <ExpertSection title="דירוג חברת השירות">
          <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-navy">
                {analytics.serviceRating.company}
              </p>
              <span
                className={`text-2xl font-bold ${
                  analytics.serviceRating.score >= 70
                    ? "text-emerald-600"
                    : analytics.serviceRating.score >= 50
                      ? "text-amber-600"
                      : "text-red-600"
                }`}
              >
                {analytics.serviceRating.score}
              </span>
            </div>
            {analytics.serviceRating.breakdown.map((item) => (
              <div key={item.label} className="mb-2 last:mb-0">
                <div className="flex justify-between text-xs mb-0.5">
                  <span className="text-gray-text">{item.label}</span>
                  <span className="font-semibold text-navy">{item.score}</span>
                </div>
                <div className="h-1 bg-gray-light rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      item.score >= 70
                        ? "bg-emerald-500"
                        : item.score >= 50
                          ? "bg-amber-500"
                          : "bg-red-500"
                    }`}
                    style={{ width: `${item.score}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </ExpertSection>

        <ExpertSection title="הערכת סיכון עתידי">
          <div className="bg-white rounded-2xl border border-red-200 p-4 shadow-sm ring-1 ring-red-100">
            <p className="text-sm font-bold text-red-600 mb-2">
              רמת סיכון: {analytics.riskAssessment.level}
            </p>
            {analytics.riskAssessment.factors.length > 0 ? (
              <ul className="text-xs text-navy/80 space-y-1 mb-3">
                {analytics.riskAssessment.factors.map((factor) => (
                  <li key={factor} className="flex items-start gap-1.5">
                    <span className="text-red-500 mt-0.5">•</span>
                    {factor}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-gray-text mb-3">לא זוהו גורמי סיכון משמעותיים</p>
            )}
            <p className="text-xs font-medium text-navy bg-red-50 rounded-lg p-2">
              {analytics.riskAssessment.prediction}
            </p>
          </div>
        </ExpertSection>

        <ExpertSection title="המלצות פעולה — פנימי">
          <div className="bg-navy rounded-2xl p-4 shadow-lg shadow-navy/20">
            <ol className="space-y-3">
              {analytics.actions.map((action, i) => (
                <li
                  key={action}
                  className="flex gap-3 text-sm text-white/90 leading-relaxed"
                >
                  <span className="w-6 h-6 rounded-full bg-gold text-navy text-xs font-bold flex items-center justify-center shrink-0">
                    {i + 1}
                  </span>
                  {action}
                </li>
              ))}
            </ol>
          </div>
        </ExpertSection>
      </main>
    </div>
  );
}
