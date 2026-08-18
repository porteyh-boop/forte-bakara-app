import {
  getClientAccessSessionByTokenServer,
  getClientPermissionsServer,
} from "@/lib/client-portal-server";
import {
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
  const session = await getClientAccessSessionByTokenServer(normalizedToken);
  const gate = resolveClientAccessGate(session);
  if (gate !== "ok" || !session) {
    return {};
  }

  const permissions = await getClientPermissionsServer(session.user.id);
  if (!permissions.can_view_building_dashboard) {
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
