"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import MasterCodeGate from "@/components/master-v2/MasterCodeGate";
import MasterShellLayout from "@/components/master-v2/MasterShellLayout";
import MasterProjectV2AiTab from "@/components/master-v2/project-v2/MasterProjectV2AiTab";
import MasterProjectV2ContactsTab from "@/components/master-v2/project-v2/MasterProjectV2ContactsTab";
import MasterProjectV2DetailsTab, {
  detailsFromCloudRow,
  emptyMasterProjectV2Details,
  type MasterProjectV2Details,
} from "@/components/master-v2/project-v2/MasterProjectV2DetailsTab";
import MasterProjectV2FaultsTab from "@/components/master-v2/project-v2/MasterProjectV2FaultsTab";
import MasterProjectV2InspectionsTab from "@/components/master-v2/project-v2/MasterProjectV2InspectionsTab";
import MasterProjectV2InspectorFollowUpPopup from "@/components/master-v2/project-v2/MasterProjectV2InspectorFollowUpPopup";
import MasterProjectV2LettersTab from "@/components/master-v2/project-v2/MasterProjectV2LettersTab";
import MasterProjectV2ReportsTab from "@/components/master-v2/project-v2/MasterProjectV2ReportsTab";
import MasterProjectV2PermissionsTab from "@/components/master-v2/project-v2/MasterProjectV2PermissionsTab";
import MasterProjectV2PlaceholderTab from "@/components/master-v2/project-v2/MasterProjectV2PlaceholderTab";
import {
  getAllCloudBuildingsWithMeta,
  getAllCloudElevators,
  type CloudBuildingRow,
} from "@/lib/buildings-cloud";
import { getProjectStage } from "@/lib/get-project-stage";
import {
  buildMasterProjectV2FaultPath,
  buildMasterProjectV2Path,
  isProjectV2TabId,
  MASTER_PROJECTS_V2_LIST_PATH,
  type ProjectV2TabId,
} from "@/lib/master-project-v2-routes";
import {
  getStaticDemoBuildingMeta,
  getAllDemoBuildingIds,
  getBuildingDataset,
} from "@/lib/buildings";
import MasterProjectV2TasksTab from "@/components/master-v2/project-v2/MasterProjectV2TasksTab";
import { ensureMasterV2SessionsValid } from "@/lib/master-v2-auth";
import {
  isMasterAuthenticated,
  isPilotCloudConfigured,
  setMasterAuthenticated,
} from "@/lib/pilot-cloud";
import {
  ForteV2Panel,
  ForteV2ProjectHeader,
  ForteV2TabButton,
  fv2,
} from "@/components/master-v2/project-v2/MasterProjectV2Workspace";

const PROJECT_V2_TABS: Array<{ id: ProjectV2TabId | "details"; label: string }> = [
  { id: "details", label: "פרטי הפרויקט" },
  { id: "letters", label: "מכתבים" },
  { id: "inspections", label: "בדיקות" },
  { id: "faults", label: "תקלות" },
  { id: "contacts", label: "אנשי קשר" },
  { id: "tasks", label: "משימות" },
  { id: "reports", label: "דוחות" },
  { id: "ai", label: "AI Assistant" },
  { id: "permissions", label: "הרשאות" },
  { id: "settings", label: "הגדרות" },
];

type ProjectV2Tab = (typeof PROJECT_V2_TABS)[number]["id"];

function resolveElevatorCount(
  buildingId: string,
  cloudCount: number | null
): string {
  if (cloudCount != null && cloudCount > 0) return String(cloudCount);
  try {
    const dataset = getBuildingDataset(buildingId);
    const count = dataset.elevators.length;
    return count > 0 ? String(count) : "—";
  } catch {
    return "—";
  }
}

function resolveDetails(
  buildingId: string,
  cloudRow: CloudBuildingRow | null,
  cloudElevatorCount: number | null
): MasterProjectV2Details {
  if (cloudRow) {
    return detailsFromCloudRow(cloudRow, cloudElevatorCount);
  }

  const demoIds = getAllDemoBuildingIds();
  if (demoIds.includes(buildingId)) {
    const demo = getStaticDemoBuildingMeta(buildingId);
    return {
      buildingId,
      projectNumber: "—",
      buildingName: demo.name,
      client: "—",
      city: demo.city ?? "—",
      elevatorCount: resolveElevatorCount(buildingId, cloudElevatorCount),
      projectStage: getProjectStage(buildingId),
      address: "—",
      managementCompany: "—",
      elevatorCompany: "—",
      maintenanceCompany: "—",
      certifiedInspector: "—",
      projectStartDate: "—",
      projectDeliveryDate: "—",
      projectNotes: "—",
    };
  }

  return emptyMasterProjectV2Details(buildingId);
}

function resolveInitialTab(
  tabParam: string | null,
  faultIdParam: string | null
): ProjectV2Tab {
  if (faultIdParam) return "faults";
  if (tabParam === "documents") return "details";
  if (tabParam && isProjectV2TabId(tabParam)) return tabParam;
  return "details";
}

export default function MasterProjectV2PageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const buildingId = (searchParams.get("buildingId") ?? "").trim().toLowerCase();
  const tabParam = searchParams.get("tab");
  const faultIdParam = (searchParams.get("faultId") ?? "").trim();

  const [authed, setAuthed] = useState(false);
  const [activeTab, setActiveTab] = useState<ProjectV2Tab>(() =>
    resolveInitialTab(tabParam, faultIdParam)
  );
  const [details, setDetails] = useState<MasterProjectV2Details>(() =>
    emptyMasterProjectV2Details(buildingId)
  );
  const [cloudRow, setCloudRow] = useState<CloudBuildingRow | null>(null);
  const [loading, setLoading] = useState(false);

  const loadProject = useCallback(async () => {
    if (!buildingId) {
      setDetails(emptyMasterProjectV2Details("—"));
      setCloudRow(null);
      return;
    }

    setLoading(true);
    let row: CloudBuildingRow | null = null;
    let cloudElevatorCount: number | null = null;

    if (isPilotCloudConfigured()) {
      const [buildingsResult, elevators] = await Promise.all([
        getAllCloudBuildingsWithMeta(),
        getAllCloudElevators(),
      ]);
      row =
        buildingsResult.rows.find((item) => item.building_id === buildingId) ??
        null;
      cloudElevatorCount = elevators.filter(
        (e) => e.building_id === buildingId && e.is_active
      ).length;
    }

    setCloudRow(row);
    setDetails(resolveDetails(buildingId, row, cloudElevatorCount));
    setLoading(false);
  }, [buildingId]);

  useEffect(() => {
    setAuthed(isMasterAuthenticated());
  }, []);

  useEffect(() => {
    if (!authed) return;
    void ensureMasterV2SessionsValid().then((ok) => {
      if (!ok) setAuthed(false);
    });
  }, [authed]);

  useEffect(() => {
    setActiveTab(resolveInitialTab(tabParam, faultIdParam));
  }, [tabParam, faultIdParam]);

  function clearFaultIdFromUrl() {
    if (!buildingId) return;
    router.replace(buildMasterProjectV2Path(buildingId, "faults"));
  }

  useEffect(() => {
    if (tabParam === "documents" && buildingId) {
      router.replace(buildMasterProjectV2Path(buildingId));
    }
  }, [tabParam, buildingId, router]);

  useEffect(() => {
    if (!authed) return;
    void loadProject();
  }, [authed, loadProject]);

  const projectTitle = useMemo(() => {
    if (details.buildingName !== "—") return details.buildingName;
    return buildingId ? `פרויקט ${buildingId}` : "תיק פרויקט";
  }, [details.buildingName, buildingId]);

  function handleLogout() {
    setMasterAuthenticated(false);
    setAuthed(false);
  }

  function handleTabChange(tab: ProjectV2Tab) {
    setActiveTab(tab);
    if (!buildingId) return;
    if (tab === "faults" && faultIdParam) {
      router.replace(buildMasterProjectV2FaultPath(buildingId, faultIdParam));
      return;
    }
    router.replace(buildMasterProjectV2Path(buildingId, tab === "details" ? undefined : tab));
  }

  function renderTabContent() {
    if (loading && activeTab === "details") {
      return <p className="text-sm text-forte-text-secondary py-8 text-center">טוען פרטי פרויקט...</p>;
    }

    if (!buildingId) {
      return (
        <p className="text-sm text-forte-text-secondary text-center py-12">
          לא נבחר פרויקט. חזרו לרשימת הפרויקטים.
        </p>
      );
    }

    switch (activeTab) {
      case "details":
        return (
          <MasterProjectV2DetailsTab
            details={details}
            cloudRow={cloudRow}
            onSaved={(row) => {
              setCloudRow(row);
              setDetails(detailsFromCloudRow(row, Number(details.elevatorCount) || null));
              void loadProject();
            }}
          />
        );
      case "letters":
        return <MasterProjectV2LettersTab buildingId={buildingId} />;
      case "inspections":
        return <MasterProjectV2InspectionsTab buildingId={buildingId} />;
      case "faults":
        return (
          <MasterProjectV2FaultsTab
            buildingId={buildingId}
            highlightFaultId={faultIdParam || null}
            onHighlightConsumed={clearFaultIdFromUrl}
          />
        );
      case "contacts":
        return <MasterProjectV2ContactsTab buildingId={buildingId} />;
      case "tasks":
        return <MasterProjectV2TasksTab buildingId={buildingId} />;
      case "reports":
        return (
          <MasterProjectV2ReportsTab
            buildingId={buildingId}
            buildingName={details.buildingName}
          />
        );
      case "ai":
        return <MasterProjectV2AiTab />;
      case "permissions":
        return <MasterProjectV2PermissionsTab buildingId={buildingId} />;
      case "settings":
        return (
          <MasterProjectV2PlaceholderTab
            stationLabel="הגדרות"
            description="תחנת הגדרות תושלם בשלב הבא."
          />
        );
      default:
        return null;
    }
  }

  if (!authed) {
    return <MasterCodeGate onSuccess={() => setAuthed(true)} />;
  }

  return (
    <MasterShellLayout
      onLogout={handleLogout}
      projectNav={buildingId ? { buildingId, activeTab } : undefined}
    >
      <div className={fv2.pageBody}>
        <ForteV2ProjectHeader
          backHref={MASTER_PROJECTS_V2_LIST_PATH}
          backLabel="חזרה לרשימת הפרויקטים"
          title={projectTitle}
          projectId={details.projectNumber}
          meta={[
            { icon: "📍", label: "עיר", value: details.city },
            { icon: "👤", label: "לקוח", value: details.client },
            { icon: "🛗", label: "מעליות", value: details.elevatorCount },
            { icon: "🏢", label: "ניהול", value: details.managementCompany },
          ]}
          tabs={
            <>
              {PROJECT_V2_TABS.map((tab) => (
                <ForteV2TabButton
                  key={tab.id}
                  active={activeTab === tab.id}
                  onClick={() => handleTabChange(tab.id)}
                >
                  {tab.label}
                </ForteV2TabButton>
              ))}
            </>
          }
        />

        <div className={fv2.workspaceCanvas}>
          {buildingId && (
            <MasterProjectV2InspectorFollowUpPopup buildingId={buildingId} />
          )}
          <ForteV2Panel large className="flex-1 min-h-[calc(100vh-15rem)] overflow-hidden flex flex-col !p-0">
            <div className="flex-1 flex flex-col min-h-0 overflow-auto p-5">
              {renderTabContent()}
            </div>
          </ForteV2Panel>
        </div>
      </div>
    </MasterShellLayout>
  );
}

