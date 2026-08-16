"use client";

import { useSearchParams } from "next/navigation";
import MasterProjectV2PageContent from "@/components/master-v2/project-v2/MasterProjectV2PageContent";

export default function MasterProjectV2PageKeyed() {
  const searchParams = useSearchParams();
  const buildingId = (searchParams.get("buildingId") ?? "").trim().toLowerCase();

  return <MasterProjectV2PageContent key={buildingId || "__none__"} />;
}
