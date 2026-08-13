import {
  checkForteMasterApiSession,
  establishForteMasterApiSession,
} from "@/lib/forte-master-api-client";
import {
  isMasterAuthenticated,
  setMasterAuthenticated,
} from "@/lib/pilot-cloud";

export async function establishMasterV2Sessions(code: string): Promise<boolean> {
  const sessionOk = await establishForteMasterApiSession(code);
  if (!sessionOk) return false;
  setMasterAuthenticated(true);
  return true;
}

/** מאמת ש-sessionStorage ו-cookie HttpOnly מסונכרנים. */
export async function ensureMasterV2SessionsValid(): Promise<boolean> {
  if (!isMasterAuthenticated()) return false;
  const sessionOk = await checkForteMasterApiSession();
  if (!sessionOk) {
    setMasterAuthenticated(false);
    return false;
  }
  return true;
}
