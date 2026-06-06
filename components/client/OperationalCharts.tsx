interface ChartItem {
  label: string;
  count: number;
}

interface OperationalChartsProps {
  faultsByType: ChartItem[];
  monthlyTrend: { month: string; count: number }[];
}

export default function OperationalCharts({
  faultsByType,
  monthlyTrend,
}: OperationalChartsProps) {
  const maxType = Math.max(...faultsByType.map((f) => f.count), 1);
  const maxMonth = Math.max(...monthlyTrend.map((m) => m.count), 1);
  const hasTypeData = faultsByType.length > 0;
  const hasTrendData = monthlyTrend.some((m) => m.count > 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm animate-fade-up">
        <h3 className="text-sm font-bold text-navy mb-4">תקלות לפי סוג</h3>
        {hasTypeData ? (
          <div className="flex flex-col gap-3">
            {faultsByType.map((item) => (
              <div key={item.label}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-navy/80 truncate ml-2">{item.label}</span>
                  <span className="font-semibold text-navy shrink-0">{item.count}</span>
                </div>
                <div className="h-2 bg-gray-light rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-l from-navy to-navy-light rounded-full transition-all duration-700"
                    style={{ width: `${(item.count / maxType) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-text text-center py-4">
            אין תקלות להצגה בגרף
          </p>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm animate-fade-up animation-delay-100">
        <h3 className="text-sm font-bold text-navy mb-4">מגמת תקלות — 4 חודשים</h3>
        {hasTrendData || monthlyTrend.length > 0 ? (
          <div className="flex items-end justify-between gap-2 h-32">
            {monthlyTrend.map((item) => (
              <div key={item.month} className="flex flex-col items-center flex-1 gap-1">
                <span className="text-xs font-semibold text-navy">{item.count}</span>
                <div
                  className="w-full bg-gradient-to-t from-gold to-gold-light rounded-t-lg transition-all duration-700"
                  style={{
                    height: `${(item.count / maxMonth) * 100}%`,
                    minHeight: item.count > 0 ? "12px" : "4px",
                  }}
                />
                <span className="text-[10px] text-gray-text">{item.month}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-text text-center py-4">
            אין נתונים להצגה בגרף
          </p>
        )}
      </div>
    </div>
  );
}
