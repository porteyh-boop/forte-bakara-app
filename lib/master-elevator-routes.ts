export function buildMasterElevatorDossierPath(
  buildingId: string,
  elevatorId: string
): string {
  return `/master/elevator/${encodeURIComponent(buildingId)}/${encodeURIComponent(elevatorId)}`;
}

export function isMasterElevatorDossierPath(pathname: string): boolean {
  return pathname.startsWith("/master/elevator/");
}

export const MASTER_ELEVATOR_DOSSIER_ROUTE_PREFIX = "/master/elevator";
