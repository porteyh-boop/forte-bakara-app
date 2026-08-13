import ForteBuildingPageContent from "@/components/forte/ForteBuildingPageContent";

interface ForteBuildingPageProps {
  params: Promise<{
    buildingId: string;
  }>;
}

export default async function ForteBuildingPage({
  params,
}: ForteBuildingPageProps) {
  const { buildingId } = await params;

  return (
    <ForteBuildingPageContent buildingId={decodeURIComponent(buildingId)} />
  );
}
