export async function establishForteMasterApiSession(
  code: string
): Promise<boolean> {
  try {
    const response = await fetch("/forte/api/master-session", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    return response.ok;
  } catch {
    return false;
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
