"use client";

import { useMemo } from "react";
import ExpertMetricCard from "@/components/expert/ExpertMetricCard";
import ExpertSection from "@/components/expert/ExpertSection";
import { useBuildingFeedback } from "@/hooks/useBuildingFeedback";
import {
  formatFeedbackDate,
  getFeedbackStats,
  RATING_LABELS,
} from "@/lib/feedback-stats";

export default function ExpertFeedbackSection() {
  const { feedback, ready } = useBuildingFeedback();
  const stats = useMemo(() => getFeedbackStats(feedback), [feedback]);

  if (!ready) {
    return (
      <ExpertSection title="משובי משתמשים">
        <div className="bg-white rounded-2xl border border-gray-200 p-6 text-center animate-pulse">
          <p className="text-sm text-gray-text">טוען משובים...</p>
        </div>
      </ExpertSection>
    );
  }

  const metrics = [
    { label: "משובים שהתקבלו", value: String(stats.total) },
    {
      label: "דירוג ממוצע",
      value: stats.total > 0 ? String(stats.avgRating) : "—",
    },
    {
      label: 'שימוש שוטף — "כן"',
      value: String(stats.wouldUseYes),
    },
    {
      label: 'המלצה לבניינים — "כן"',
      value: String(stats.wouldRecommendYes),
    },
  ];

  return (
    <ExpertSection title="משובי משתמשים">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
        {metrics.map((metric, i) => (
          <ExpertMetricCard key={metric.label} metric={metric} index={i} />
        ))}
      </div>

      {stats.recent.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-5 text-center">
          <p className="text-sm text-gray-text">
            עדיין לא התקבל משוב לבניין זה.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {stats.recent.map((item, i) => (
            <article
              key={item.id}
              className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm animate-fade-up"
              style={{ animationDelay: `${i * 40}ms` }}
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <div>
                  <p className="text-sm font-bold text-navy">{item.senderName}</p>
                  <p className="text-xs text-gray-text">{item.senderRole}</p>
                </div>
                <span className="text-xs font-semibold text-gold bg-gold/10 rounded-lg px-2 py-1 shrink-0">
                  {RATING_LABELS[item.rating]}
                </span>
              </div>

              <div className="flex flex-wrap gap-2 text-xs mb-3">
                <span className="rounded-lg bg-gray-light px-2 py-1 text-navy/80">
                  שימוש שוטף: {item.wouldUseRegularly}
                </span>
                <span className="rounded-lg bg-gray-light px-2 py-1 text-navy/80">
                  המלצה: {item.wouldRecommend}
                </span>
              </div>

              {(item.unclearOrMissing || item.expectedFeature) && (
                <div className="text-sm text-navy/80 space-y-2 mb-3">
                  {item.unclearOrMissing && (
                    <p>
                      <span className="font-semibold text-navy">חסר / לא ברור: </span>
                      {item.unclearOrMissing}
                    </p>
                  )}
                  {item.expectedFeature && (
                    <p>
                      <span className="font-semibold text-navy">פעולה מצופה: </span>
                      {item.expectedFeature}
                    </p>
                  )}
                </div>
              )}

              <p className="text-xs text-gray-text">
                {formatFeedbackDate(item.createdAt)}
              </p>
            </article>
          ))}
        </div>
      )}
    </ExpertSection>
  );
}
