interface InfoCardProps {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  accent?: boolean;
  delay?: number;
}

export default function InfoCard({
  label,
  value,
  icon,
  accent,
  delay = 0,
}: InfoCardProps) {
  return (
    <div
      className={`rounded-2xl p-4 flex flex-col gap-2.5 animate-fade-up transition-transform duration-300 hover:scale-[1.02] ${
        accent
          ? "bg-gradient-to-br from-navy to-navy-light text-white shadow-lg shadow-navy/25"
          : "bg-white border border-gray-200 shadow-sm"
      }`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-center justify-between">
        <span
          className={`text-xs font-medium ${
            accent ? "text-gold-light" : "text-gray-text"
          }`}
        >
          {label}
        </span>
        <span className={accent ? "text-gold" : "text-gold/70"}>{icon}</span>
      </div>
      <span
        className={`text-3xl font-bold tracking-tight ${
          accent ? "text-white" : "text-navy"
        }`}
      >
        {value}
      </span>
    </div>
  );
}
