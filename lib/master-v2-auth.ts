import {
  authenticateMasterWithCode,
  type MasterAuthClientError,
} from "@/lib/master-auth-client";
import { checkForteMasterApiSession } from "@/lib/forte-master-api-client";
import { isMasterAuthenticated, setMasterAuthenticated } from "@/lib/pilot-cloud";

export async function establishMasterV2Sessions(
  code: string
): Promise<{ ok: true } | { ok: false; error: MasterAuthClientError }> {
  return authenticateMasterWithCode(code);
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
