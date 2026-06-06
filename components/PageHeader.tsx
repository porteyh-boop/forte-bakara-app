import { BRAND_APP } from "@/lib/brand";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  badge?: string;
}

export default function PageHeader({ title, subtitle, badge }: PageHeaderProps) {
  return (
    <header className="relative bg-navy text-white overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(201,169,98,0.15),transparent_60%)]" />
      <div className="absolute -top-20 -left-20 w-64 h-64 bg-gold/5 rounded-full blur-3xl" />
      <div className="relative max-w-lg mx-auto px-5 pt-10 pb-8">
        <div className="flex items-center gap-2 mb-2">
          <span className="w-8 h-0.5 bg-gold rounded-full" />
          <span className="text-gold text-xs font-semibold tracking-widest">
            {BRAND_APP}
          </span>
          {badge && (
            <span className="mr-auto text-[10px] font-medium bg-white/10 text-gold-light px-2 py-0.5 rounded-full">
              {badge}
            </span>
          )}
        </div>
        <h1 className="text-2xl font-bold leading-tight">{title}</h1>
        {subtitle && (
          <p className="text-white/65 text-sm mt-1.5 leading-relaxed">{subtitle}</p>
        )}
      </div>
      <div className="h-6 bg-gray-light rounded-t-3xl" />
    </header>
  );
}
