interface BuildingDetailRowProps {
  label: string;
  value: string;
  icon: React.ReactNode;
  href?: string;
}

export default function BuildingDetailRow({
  label,
  value,
  icon,
  href,
}: BuildingDetailRowProps) {
  const content = (
    <div className="flex items-center gap-4 py-4 border-b border-gray-100 last:border-0">
      <div className="w-10 h-10 rounded-xl bg-navy/5 flex items-center justify-center text-gold shrink-0">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-gray-text mb-0.5">{label}</p>
        <p
          className={`text-base font-medium truncate ${
            href ? "text-gold" : "text-navy"
          }`}
        >
          {value}
        </p>
      </div>
      {href && (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 text-gray-text shrink-0 rotate-180">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      )}
    </div>
  );

  if (href) {
    return (
      <a href={href} className="block hover:bg-gray-light/50 -mx-2 px-2 rounded-lg transition-colors">
        {content}
      </a>
    );
  }

  return content;
}
