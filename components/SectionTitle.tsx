import Link from "next/link";

interface SectionTitleProps {
  title: string;
  action?: { label: string; href: string };
}

export default function SectionTitle({ title, action }: SectionTitleProps) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="text-base font-bold text-navy">{title}</h2>
      {action && (
        <Link
          href={action.href}
          className="text-sm font-medium text-gold hover:text-gold/80 transition-colors"
        >
          {action.label}
        </Link>
      )}
    </div>
  );
}
