import { BRAND_INTERNAL_ONLY } from "@/lib/brand";

export default function InternalBadge() {
  return (
    <div className="flex items-center gap-2 bg-red-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold shadow-lg shadow-red-600/25 animate-fade-up">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 shrink-0">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m0 0v2m0-2h2m-2 0H10M6.343 6.343a8 8 0 1011.314 0M12 9v2" />
      </svg>
      <span>{BRAND_INTERNAL_ONLY}</span>
    </div>
  );
}
