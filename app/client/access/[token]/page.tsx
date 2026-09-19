import { headers } from "next/headers";
import ClientAccessPageContent from "@/components/ClientAccessPageContent";
import { resolveClientPortalViewMode } from "@/lib/client-portal-view-mode";

interface ClientAccessPageProps {
  params: Promise<{ token: string }>;
}

export default async function ClientAccessPage({ params }: ClientAccessPageProps) {
  const { token } = await params;
  const headerStore = await headers();
  const initialViewMode = resolveClientPortalViewMode(
    headerStore.get("user-agent")
  );

  return (
    <ClientAccessPageContent
      token={decodeURIComponent(token)}
      initialViewMode={initialViewMode}
    />
  );
}
