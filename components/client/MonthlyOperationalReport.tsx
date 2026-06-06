interface MonthlyReport {
  month: string;
  totalReported: number;
  closed: number;
  open: number;
  availability: number;
  avgResolutionDays: number;
  reportsSubmitted: number;
}

interface MonthlyOperationalReportProps {
  report: MonthlyReport;
}

export default function MonthlyOperationalReport({
  report,
}: MonthlyOperationalReportProps) {
  const rows = [
    { label: "דיווחים שהתקבלו", value: report.totalReported },
    { label: "תקלות שנסגרו", value: report.closed },
    { label: "תקלות פתוחות", value: report.open },
    { label: "זמינות מעליות", value: `${report.availability}%` },
    { label: "זמן סגירה ממוצע", value: `${report.avgResolutionDays} ימים` },
  ];

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden animate-fade-up">
      <div className="px-4 py-3 bg-navy/5 border-b border-gray-100">
        <h3 className="text-sm font-bold text-navy">דוח חודשי תפעולי</h3>
        <p className="text-xs text-gray-text mt-0.5">{report.month}</p>
      </div>
      <div className="divide-y divide-gray-100">
        {rows.map((row) => (
          <div
            key={row.label}
            className="flex items-center justify-between px-4 py-3"
          >
            <span className="text-sm text-navy/70">{row.label}</span>
            <span className="text-sm font-bold text-navy">{row.value}</span>
          </div>
        ))}
      </div>
      <p className="px-4 py-3 text-[11px] text-gray-text bg-gray-light/50 border-t border-gray-100">
        דוח תפעולי בלבד — ללא ניתוח מקצועי או המלצות
      </p>
    </div>
  );
}
