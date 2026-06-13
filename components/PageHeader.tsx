import {
  BRAND_APP,
  BRAND_EDITOR_NAME,
  BRAND_TAGLINE,
} from "@/lib/brand";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  badge?: string;
  wide?: boolean;
  master?: boolean;
}

export default function PageHeader({
  title,
  subtitle,
  badge,
  wide = false,
  master = false,
}: PageHeaderProps) {
  const isHome = title === BRAND_APP;
  const contentWidthClass = master
    ? "max-w-lg md:max-w-7xl"
    : wide
      ? "max-w-lg md:max-w-6xl"
      : "max-w-lg md:max-w-2xl";

  return (
    <header dir="rtl" className="relative bg-navy text-white overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(201,169,98,0.15),transparent_60%)]" />
      <div className="absolute -top-20 -left-20 w-64 h-64 bg-gold/5 rounded-full blur-3xl" />
      <div
        className={`relative ${contentWidthClass} mx-auto px-5 pt-10 pb-8 md:pt-12 md:pb-10`}
      >
        {badge && (
          <div className="flex justify-end mb-4 md:mb-5">
            <span className="text-[10px] md:text-xs font-medium bg-white/10 text-gold-light px-2.5 py-1 rounded-full">
              {badge}
            </span>
          </div>
        )}

        <div className="flex flex-col gap-2.5 md:gap-3.5">
          <p className="text-gold text-xs md:text-sm font-semibold tracking-wide leading-none">
            {BRAND_EDITOR_NAME}
          </p>
          <h1 className="text-3xl md:text-[2rem] font-bold leading-tight text-white">
            {BRAND_APP}
          </h1>
          <p className="text-base md:text-lg text-white/80 font-medium leading-relaxed">
            {BRAND_TAGLINE}
          </p>
        </div>

        {!isHome && (
          <div className="mt-5 md:mt-7 pt-4 md:pt-5 border-t border-white/10">
            <h2 className="text-lg md:text-xl font-bold leading-tight text-white">
              {title}
            </h2>
            {subtitle && (
              <p className="text-white/65 text-sm md:text-base mt-2 leading-relaxed">
                {subtitle}
              </p>
            )}
          </div>
        )}
      </div>
      <div className="h-6 bg-gray-light rounded-t-3xl" />
    </header>
  );
}
