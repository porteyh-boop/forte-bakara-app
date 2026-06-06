import {
  BRAND_APP,
  BRAND_EDITOR_NAME,
  BRAND_EDITOR_TITLE,
  BRAND_FORTE,
} from "@/lib/brand";

export default function AppFooter() {
  return (
    <footer className="print:hidden max-w-lg mx-auto px-5 py-6 pb-28 text-center">
      <p className="text-xs font-bold text-navy">{BRAND_EDITOR_NAME}</p>
      <p className="text-[11px] text-gray-text mt-0.5">{BRAND_EDITOR_TITLE}</p>
      <p className="text-[10px] text-gold font-semibold tracking-widest mt-2">
        {BRAND_FORTE}
      </p>
      <p className="text-[10px] text-gray-text mt-1">{BRAND_APP}</p>
    </footer>
  );
}
