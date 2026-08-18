import {
  getClientAccessByToken,
  resolveClientAccessGate,
} from "@/lib/client-access";
import { resolveClientPortalBuilding } from "@/lib/client-portal-building";
import {
  normalizeClientPortalToken,
  type ClientPortalManifestLabels,
} from "@/lib/client-portal-manifest";

export async function resolveClientPortalManifestLabels(
  token: string
): Promise<ClientPortalManifestLabels> {
  const normalizedToken = normalizeClientPortalToken(token);
  const session = await getClientAccessByToken(normalizedToken);
  const gate = resolveClientAccessGate(session);
  if (gate !== "ok" || !session) {
    return {};
  }

  const resolved = await resolveClientPortalBuilding(
    session.access.building_id
  );
  if (!resolved) {
    return {};
  }

  return { buildingName: resolved.buildingName };
}
