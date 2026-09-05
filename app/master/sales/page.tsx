import { Suspense } from "react";
import MasterSalesLeadsView from "@/components/master-v2/MasterSalesLeadsView";

export default async function MasterSalesPage({
  searchParams,
}: {
  searchParams: Promise<{ leadId?: string | string[] }>;
}) {
  const params = await searchParams;
  const raw = params.leadId;
  const leadId = Array.isArray(raw) ? raw[0] ?? "" : raw ?? "";
  return (
    <Suspense fallback={null}>
      <MasterSalesLeadsView initialLeadId={leadId} />
    </Suspense>
  );
}
