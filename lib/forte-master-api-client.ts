export type MasterSessionEstablishError =
  | "wrong_code"
  | "server_unconfigured"
  | "network";

export async function establishForteMasterApiSession(code: string): Promise<
  | { ok: true }
  | { ok: false; error: MasterSessionEstablishError }
> {
  try {
    const response = await fetch("/forte/api/master-session", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    if (response.ok) return { ok: true };
    if (response.status === 401) return { ok: false, error: "wrong_code" };
    if (response.status === 503) return { ok: false, error: "server_unconfigured" };
    return { ok: false, error: "network" };
  } catch {
    return { ok: false, error: "network" };
  }
}

export async function checkForteMasterApiSession(): Promise<boolean> {
  try {
    const response = await fetch("/forte/api/master-session", {
      method: "GET",
      credentials: "include",
    });
    return response.ok;
  } catch {
    return false;
  }
}
