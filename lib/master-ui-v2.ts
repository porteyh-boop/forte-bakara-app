export function isMasterUiV2Enabled(
  searchParams: Pick<URLSearchParams, "get"> | null | undefined
): boolean {
  if (searchParams?.get("legacy") === "1") return false;
  if (searchParams?.get("ui") === "v2") return true;
  return process.env.NEXT_PUBLIC_MASTER_UI_V2 === "1";
}

export function masterLegacyTabHref(tab: string): string {
  return `/master?legacy=1&tab=${encodeURIComponent(tab)}`;
}
