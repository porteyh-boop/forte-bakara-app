export function buildMasterBuildingDossierPath(buildingId: string): string {
  return `/master/building/${encodeURIComponent(buildingId)}`;
}

export function isMasterBuildingDossierPath(pathname: string): boolean {
  return pathname.startsWith("/master/building/");
}

export const MASTER_BUILDING_DOSSIER_ROUTE_PREFIX = "/master/building";
