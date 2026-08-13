export function buildForteBuildingPath(buildingId: string): string {
  return `/forte/building/${encodeURIComponent(buildingId)}`;
}

export function isForteBuildingPath(pathname: string): boolean {
  return pathname.startsWith("/forte/building/");
}
