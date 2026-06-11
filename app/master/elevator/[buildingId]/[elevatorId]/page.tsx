import MasterElevatorDossierPageContent from "@/components/MasterElevatorDossierPageContent";

interface MasterElevatorDossierPageProps {
  params: Promise<{
    buildingId: string;
    elevatorId: string;
  }>;
}

export default async function MasterElevatorDossierPage({
  params,
}: MasterElevatorDossierPageProps) {
  const { buildingId, elevatorId } = await params;

  return (
    <MasterElevatorDossierPageContent
      buildingId={decodeURIComponent(buildingId)}
      elevatorId={decodeURIComponent(elevatorId)}
    />
  );
}
