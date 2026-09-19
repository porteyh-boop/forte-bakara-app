export type ClientPortalViewMode = "mobile" | "desktop";

/** Phone-class user agents (not tablets / desktop browsers). */
const MOBILE_PHONE_UA =
  /Android.+Mobile|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini|Mobile Safari/i;

export function resolveClientPortalViewMode(
  userAgent: string | null | undefined
): ClientPortalViewMode {
  const ua = userAgent?.trim() ?? "";
  if (!ua) {
    return "desktop";
  }
  if (MOBILE_PHONE_UA.test(ua)) {
    return "mobile";
  }
  return "desktop";
}

/** Client-side: phones stay mobile; desktop/tablet browsers get desktop layout. */
export function resolveClientPortalViewModeInBrowser(): ClientPortalViewMode {
  if (typeof navigator === "undefined") {
    return "desktop";
  }
  const fromUa = resolveClientPortalViewMode(navigator.userAgent);
  if (fromUa === "mobile") {
    return "mobile";
  }
  return "desktop";
}

/** Pick Tailwind class list by active portal view (not only CSS breakpoints). */
export function pl(
  mode: ClientPortalViewMode,
  mobile: string,
  desktop: string
): string {
  return mode === "desktop" ? desktop : mobile;
}
