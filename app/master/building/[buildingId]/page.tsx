import MasterBuildingDossierPageContent from "@/components/MasterBuildingDossierPageContent";

interface MasterBuildingDossierPageProps {
  params: Promise<{
    buildingId: string;
  }>;
}

export default async function MasterBuildingDossierPage({
  params,
}: MasterBuildingDossierPageProps) {
  const { buildingId } = await params;

  return (
    <MasterBuildingDossierPageContent
      buildingId={decodeURIComponent(buildingId)}
    />
  );
}
