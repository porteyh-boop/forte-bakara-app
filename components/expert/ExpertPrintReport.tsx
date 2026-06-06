import type { ExpertPdfReportData } from "@/lib/expert-pdf-data";
import {
  BRAND_EDITOR_NAME,
  BRAND_EDITOR_TITLE,
  BRAND_FORTE,
  BRAND_INTERNAL_ONLY,
  BRAND_REPORT_TITLE,
  BRAND_SIGNATURE,
} from "@/lib/brand";

interface ExpertPrintReportProps {
  data: ExpertPdfReportData;
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="print-section">
      <h2 className="print-section-title">{title}</h2>
      {children}
    </section>
  );
}

function Row({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="print-row">
      <span className="print-label">{label}</span>
      <span className="print-value">{String(value)}</span>
    </div>
  );
}

export default function ExpertPrintReport({ data }: ExpertPrintReportProps) {
  const { building: b, faultSummary, lifecycleStats, analytics: a, feedbackSummary: fb } = data;
  const recurringElevators = a.recurringByElevator.filter((e) => e.isRecurring);
  const recurringTypes = a.recurringByType.filter((t) => t.isRecurring);

  return (
    <div className="print-report" dir="rtl">
      <header className="print-header">
        <p className="print-forte">{BRAND_FORTE}</p>
        <h1 className="print-title">{BRAND_REPORT_TITLE}</h1>
        <div className="print-meta">
          <p className="print-meta-label">הוכן עבור:</p>
          <p className="print-meta-value">{b.name}</p>
          <p className="print-meta-label">נערך על ידי:</p>
          <p className="print-meta-value">{BRAND_EDITOR_NAME}</p>
          <p className="print-meta-sub">{BRAND_EDITOR_TITLE}</p>
          <p className="print-meta-date">הופק: {data.generatedAt}</p>
        </div>
      </header>

      <p className="print-badge">{BRAND_INTERNAL_ONLY}</p>

      <Section title="פרטי בניין">
        <Row label="שם בניין" value={b.name} />
        <Row label="כתובת" value={`${b.address}, ${b.city}`} />
        <Row label="מספר מעליות" value={b.elevatorCount} />
        <Row label="חברת מעליות" value={b.elevatorCompany} />
        <Row label="חברת ניהול" value={b.managementCompany} />
      </Section>

      <Section title="סיכום תקלות">
        <Row label="סה״כ תקלות" value={faultSummary.total} />
        <Row label="תקלות פתוחות" value={faultSummary.open} />
        <Row label="תקלות סגורות" value={faultSummary.closed} />
      </Section>

      <Section title="סיכום משובי פיילוט">
        <Row label="מספר משובים" value={fb.total} />
        <Row
          label="דירוג ממוצע"
          value={fb.total > 0 ? fb.avgRating : "—"}
        />
        <Row
          label="שימוש שוטף — כן / אולי / לא"
          value={`${fb.wouldUseCounts.כן} / ${fb.wouldUseCounts.אולי} / ${fb.wouldUseCounts.לא}`}
        />
        <Row
          label="המלצה לבניינים נוספים — כן / אולי / לא"
          value={`${fb.recommendCounts.כן} / ${fb.recommendCounts.אולי} / ${fb.recommendCounts.לא}`}
        />
      </Section>

      <Section title="מחזור חיים וסטטיסטיקות">
        <Row
          label="זמן טיפול ממוצע"
          value={`${lifecycleStats.avgTreatmentHours} שעות`}
        />
        <Row
          label="זמן השבתה ממוצע"
          value={`${lifecycleStats.avgDowntimeHours} שעות`}
        />
        <Row label="אחוז זמינות" value={`${lifecycleStats.availabilityPercent}%`} />
        <Row label="נסגרו החודש" value={lifecycleStats.closedThisMonth} />
        <Row
          label="נפתרו תוך 24 שעות"
          value={`${lifecycleStats.resolvedWithin24hPercent}%`}
        />
      </Section>

      <Section title="מדדים עיקריים">
        {a.metrics.map((metric) => (
          <Row key={metric.label} label={metric.label} value={metric.value} />
        ))}
      </Section>

      <Section title="זמינות מעליות">
        {a.elevatorAvailability.map((e) => (
          <Row
            key={e.elevatorId}
            label={e.elevatorName}
            value={`${e.availabilityPercent}% (${e.faultCount} תקלות, ${e.downtimeHours} שעות השבתה)`}
          />
        ))}
      </Section>

      <Section title="תקלות חוזרות לפי מעלית">
        {a.recurringByElevator.map((e) => (
          <Row
            key={e.elevatorId}
            label={e.elevatorName}
            value={`${e.faultCount} תקלות (${e.percentage}%)${e.isRecurring ? " · חוזר" : ""}`}
          />
        ))}
      </Section>

      <Section title="תקלות חוזרות לפי סוג">
        {a.recurringByType.map((t) => (
          <Row
            key={t.type}
            label={t.type}
            value={`${t.count} מקרים (${t.percentage}%)${t.isRecurring ? " · חוזר" : ""}`}
          />
        ))}
      </Section>

      {recurringElevators.length > 0 || recurringTypes.length > 0 ? (
        <Section title="סיכום חזרתיות">
          {recurringElevators.map((e) => (
            <Row
              key={`rec-${e.elevatorId}`}
              label={e.elevatorName}
              value={`${e.faultCount} תקלות חוזרות`}
            />
          ))}
          {recurringTypes.map((t) => (
            <Row key={`rec-${t.type}`} label={t.type} value={`${t.count} מקרים חוזרים`} />
          ))}
        </Section>
      ) : null}

      {a.failurePatterns.length > 0 && (
        <Section title="זיהוי דפוסי כשל">
          <ul className="print-list">
            {a.failurePatterns.map((pattern) => (
              <li key={pattern}>{pattern}</li>
            ))}
          </ul>
        </Section>
      )}

      <Section title="חלוקה לפי סוגי תקלות">
        {a.faultTypeBreakdown.map((item) => (
          <Row
            key={item.type}
            label={item.type}
            value={`${item.count} (${item.percentage}%)`}
          />
        ))}
      </Section>

      <Section title="מעלית בעייתית">
        <Row label="מעלית" value={a.problematicElevator.name} />
        <Row label="מספר תקלות" value={a.problematicElevator.faultCount} />
        <Row label="אחוז מסך הכל" value={`${a.problematicElevator.percentage}%`} />
        <Row label="שעות השבתה" value={a.problematicElevator.downtimeHours} />
        <p className="print-note">{a.problematicElevator.reason}</p>
      </Section>

      <Section title="זמן תגובה ממוצע">
        <Row label="ממוצע" value={`${a.responseTime.averageHours} שעות`} />
        <Row label="יעד" value={`${a.responseTime.targetHours} שעות`} />
        <Row label="עמידה ביעד" value={`${a.responseTime.compliancePercent}%`} />
        <Row label="מקרה גרוע ביותר" value={a.responseTime.worstCase} />
      </Section>

      <Section title="זמן השבתה ממוצע">
        <Row label="ממוצע" value={`${a.downtime.averageHours} שעות`} />
        <Row label="סה״כ" value={`${a.downtime.totalHours} שעות`} />
        <Row label="החודש" value={`${a.downtime.monthHours} שעות`} />
        <Row label="אירוע ארוך ביותר" value={a.downtime.longestEvent} />
      </Section>

      <Section title="ציון שירות חברת המעליות">
        <Row label="חברה" value={a.serviceRating.company} />
        <Row label="ציון כולל" value={`${a.serviceRating.score}/100`} />
        {a.serviceRating.breakdown.map((item) => (
          <Row key={item.label} label={item.label} value={item.score} />
        ))}
      </Section>

      <Section title="מגמת שיפור / החמרה">
        <Row label="כיוון" value={a.trend.direction} />
        <Row
          label="שינוי בתקלות"
          value={`${a.trend.faultCountChangePercent > 0 ? "+" : ""}${a.trend.faultCountChangePercent}%`}
        />
        <Row
          label="שינוי בהשבתה"
          value={`${a.trend.downtimeChangePercent > 0 ? "+" : ""}${a.trend.downtimeChangePercent}%`}
        />
        <p className="print-note">{a.trend.description}</p>
      </Section>

      {a.alerts.length > 0 && (
        <Section title="התראות על חריגה">
          {a.alerts.map((alert) => (
            <p key={alert.id} className="print-alert">
              {alert.message}
            </p>
          ))}
        </Section>
      )}

      <Section title="תובנות פנימיות">
        {a.insights.map((insight) => (
          <div key={insight.id} className="print-insight">
            <span className="print-insight-cat">{insight.category}</span>
            <p>{insight.text}</p>
          </div>
        ))}
      </Section>

      <Section title="הערכת סיכון עתידי">
        <Row label="רמת סיכון" value={a.riskAssessment.level} />
        <ul className="print-list">
          {a.riskAssessment.factors.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
        <p className="print-note">{a.riskAssessment.prediction}</p>
      </Section>

      {a.insufficientTreatment.suspiciousCases > 0 && (
        <Section title="חשד לטיפול לא מספק">
          <Row label="חברה" value={a.insufficientTreatment.company} />
          <Row label="מקרים חשודים" value={a.insufficientTreatment.suspiciousCases} />
          <p className="print-note">{a.insufficientTreatment.detail}</p>
        </Section>
      )}

      <Section title="המלצות פעולה — פנימי">
        <ol className="print-actions">
          {a.actions.map((action) => (
            <li key={action}>{action}</li>
          ))}
        </ol>
      </Section>

      <footer className="print-footer">
        <p className="print-signature-greeting">{BRAND_SIGNATURE.greeting}</p>
        <p className="print-signature-name">{BRAND_SIGNATURE.name}</p>
        <p className="print-signature-title">{BRAND_SIGNATURE.title}</p>
        <p className="print-signature-forte">{BRAND_SIGNATURE.forte}</p>
        <p className="print-badge-inline">{BRAND_INTERNAL_ONLY}</p>
      </footer>
    </div>
  );
}
