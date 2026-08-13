"use client";

import ForteBuildingContactsListSection from "@/components/forte/ForteBuildingContactsListSection";

type ForteBuildingTab = "details" | "contacts";

interface ForteBuildingDetailsTabContentProps {
  buildingId: string;
  activeTab: ForteBuildingTab;
}

export default function ForteBuildingDetailsTabContent({
  buildingId,
  activeTab,
}: ForteBuildingDetailsTabContentProps) {
  if (activeTab === "contacts") {
    return (
      <ForteBuildingContactsListSection buildingId={buildingId} />
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4">
      <p className="text-sm text-gray-text">פרטי הבניין והתקשרות — בקרוב.</p>
    </div>
  );
}
