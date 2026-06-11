import ClientAccessPageContent from "@/components/ClientAccessPageContent";

interface ClientAccessPageProps {
  params: Promise<{ token: string }>;
}

export default async function ClientAccessPage({ params }: ClientAccessPageProps) {
  const { token } = await params;

  return <ClientAccessPageContent token={decodeURIComponent(token)} />;
}
