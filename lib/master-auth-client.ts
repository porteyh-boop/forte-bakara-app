import { establishForteMasterApiSession } from "@/lib/forte-master-api-client";
import { setMasterAuthenticated } from "@/lib/pilot-cloud";

export type MasterAuthClientError =
  | "empty_code"
  | "wrong_code"
  | "server_unconfigured"
  | "network";

export function masterAuthErrorMessage(error: MasterAuthClientError): string {
  switch (error) {
    case "empty_code":
      return "יש להזין קוד גישה.";
    case "wrong_code":
      return "קוד גישה שגוי.";
    case "server_unconfigured":
      return "קוד הגישה לא מוגדר בשרת (MASTER_CODE).";
    case "network":
      return "אימות שרת נכשל. נסו שוב.";
  }
}

/** Validates master code on the server only; sets client session flags on success. */
export async function authenticateMasterWithCode(
  code: string
): Promise<{ ok: true } | { ok: false; error: MasterAuthClientError }> {
  const trimmed = code.trim();
  if (!trimmed) {
    return { ok: false, error: "empty_code" };
  }

  const result = await establishForteMasterApiSession(trimmed);
  if (result.ok) {
    setMasterAuthenticated(true);
    return { ok: true };
  }

  return { ok: false, error: result.error };
}
