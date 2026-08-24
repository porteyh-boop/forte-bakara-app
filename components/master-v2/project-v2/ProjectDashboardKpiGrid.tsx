"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { listProjectPayments } from "@/lib/project-payments-cloud";
import { listProjectTasks } from "@/lib/project-tasks-cloud";
import {
  isTabAllowedForProjectType,
  normalizeProjectType,
} from "@/lib/project-type-config";
import { buildStatisticsSnapshot, fetchStatisticsFaultRows } from "@/lib/statistics";
import { isPilotCloudConfigured } from "@/lib/pilot-cloud";
import {
  ForteV2Panel,
  ForteV2StatusBadge,
} from "@/components/master-v2/project-v2/MasterProjectV2Workspace";
import type { ReactNode } from "react";
import type { CloudBuildingRow } from "@/lib/buildings-cloud";
import { getProjectProgress, getProjectStage } from "@/lib/get-project-stage";
import { computeInspectorFollowUpAlerts } from "@/lib/inspector-follow-up-letters";
import {
  buildPreparedStagesFromInspectorListResponse,
  listMasterInspectorReports,
  mapMasterInspectorReportListItemToRecord,
} from "@/lib/master-inspector-reports-api";
import { listMasterDocumentsByBuilding } from "@/lib/master-documents-api";
import { listMasterFaultsByBuilding } from "@/lib/master-faults-api";
import { buildMasterProjectV2Path, type ProjectV2TabId } from "@/lib/master-project-v2-routes";
import {
  collectionStatusTone,
  computeProjectFinancialSummary,
  formatMoney,
  type CollectionStatus,
} from "@/lib/project-financial";

interface ProjectDashboardKpiGridProps {
  buildingId: string;
  cloudRow: CloudBuildingRow | null;
}

interface KpiCardProps {
  label: string;
  href?: string;
  loading?: boolean;
  error?: boolean;
  children: ReactNode;
}

function KpiCard({ label, href, loading, error, children }: KpiCardProps) {
  const className =
    "block rounded-lg border border-forte-border/70 bg-white p-3 min-h-[88px] transition-colors " +
    (href ? "hover:border-forte-primary/40 hover:bg-forte-primary/5 cursor-pointer" : "");

  const inner = (
    <>
      <p className="text-[11px] font-semibold text-forte-text-secondary">{label}</p>
      {loading ? (
        <div className="mt-2 space-y-2 animate-pulse">
          <div className="h-4 bg-forte-border/50 rounded w-3/4" />
          <div className="h-3 bg-forte-border/40 rounded w-1/2" />
        </div>
      ) : error ? (
        <p className="mt-2 text-xs text-forte-text-secondary">—</p>
      ) : (
        <div className="mt-1.5">{children}</div>
      )}
    </>
  );

  if (href && !loading && !error) {
    return (
      <Link href={href} className={className}>
        {inner}
      </Link>
    );
  }

  return <div className={className}>{inner}</div>;
}

const CLOSED_FAULT_STATUS = "סגורה";
const OPEN_TASK_STATUSES = new Set(["פתוחה", "בתהליך"]);

export default function ProjectDashboardKpiGrid({
  buildingId,
  cloudRow,
}: ProjectDashboardKpiGridProps) {
  const cloudReady = isPilotCloudConfigured();
  const projectType = normalizeProjectType(cloudRow?.project_type);

  const [tasksState, setTasksState] = useState({ loading: true, error: false, open: 0 });
  const [faultsState, setFaultsState] = useState({
    loading: true,
    error: false,
    open: 0,
    last30d: 0,
  });
  const [inspectionsState, setInspectionsState] = useState({
    loading: true,
    error: false,
    followUp: 0,
  });
  const [documentsState, setDocumentsState] = useState({
    loading: true,
    error: false,
    count: 0,
  });
  const [financialState, setFinancialState] = useState({
    loading: true,
    error: false,
    order: null as number | null,
    paid: 0,
    balance: null as number | null,
    status: "לא הוגדר" as CollectionStatus,
  });

  const stageLabel = useMemo(() => {
    if (!cloudRow) return "—";
    return getProjectStage(cloudRow.building_id, {
      storedStage: cloudRow.project_stage,
      liveStartedAt: cloudRow.live_started_at,
      projectType,
      workflowState: cloudRow.project_workflow_state,
      storedProgress: cloudRow.project_progress,
    });
  }, [cloudRow, projectType]);

  const progressPercent = useMemo(() => {
    if (!cloudRow) return null;
    return getProjectProgress({
      storedStage: cloudRow.project_stage,
      liveStartedAt: cloudRow.live_started_at,
      projectType,
      workflowState: cloudRow.project_workflow_state,
      storedProgress: cloudRow.project_progress,
    });
  }, [cloudRow, projectType]);

  function tabHref(tab: ProjectV2TabId): string | undefined {
    if (!isTabAllowedForProjectType(projectType, tab)) return undefined;
    return buildMasterProjectV2Path(buildingId, tab);
  }

  useEffect(() => {
    if (!buildingId || !cloudReady) {
      setTasksState({ loading: false, error: !cloudReady && Boolean(buildingId), open: 0 });
      setFaultsState({ loading: false, error: !cloudReady && Boolean(buildingId), open: 0, last30d: 0 });
      setInspectionsState({ loading: false, error: !cloudReady && Boolean(buildingId), followUp: 0 });
      setDocumentsState({ loading: false, error: !cloudReady && Boolean(buildingId), count: 0 });
      setFinancialState({
        loading: false,
        error: !cloudReady && Boolean(buildingId),
        order: null,
        paid: 0,
        balance: null,
        status: "לא הוגדר",
      });
      return;
    }

    let cancelled = false;

    async function loadKpis() {
      setTasksState((s) => ({ ...s, loading: true, error: false }));
      setFaultsState((s) => ({ ...s, loading: true, error: false }));
      setInspectionsState((s) => ({ ...s, loading: true, error: false }));
      setDocumentsState((s) => ({ ...s, loading: true, error: false }));
      setFinancialState((s) => ({ ...s, loading: true, error: false }));

      const [
        tasksResult,
        faultsResult,
        inspectionsResult,
        documentsResult,
        statsResult,
        paymentsResult,
      ] = await Promise.allSettled([
        listProjectTasks(buildingId),
        listMasterFaultsByBuilding(buildingId),
        listMasterInspectorReports(buildingId),
        listMasterDocumentsByBuilding(buildingId),
        fetchStatisticsFaultRows(buildingId),
        listProjectPayments(buildingId),
      ]);

      if (cancelled) return;

      if (tasksResult.status === "fulfilled") {
        const open = tasksResult.value.tasks.filter((t) =>
          OPEN_TASK_STATUSES.has(t.status)
        ).length;
        setTasksState({ loading: false, error: false, open });
      } else {
        setTasksState({ loading: false, error: true, open: 0 });
      }

      if (faultsResult.status === "fulfilled" && statsResult.status === "fulfilled") {
        const open = faultsResult.value.filter(
          (f) => f.status !== CLOSED_FAULT_STATUS
        ).length;
        let last30d = 0;
        if (statsResult.value.ok) {
          last30d = buildStatisticsSnapshot(
            statsResult.value.rows,
            buildingId,
            "30d"
          ).totalFaults;
        }
        setFaultsState({
          loading: false,
          error: !statsResult.value.ok && faultsResult.value.length === 0,
          open,
          last30d: statsResult.value.ok ? last30d : 0,
        });
      } else {
        setFaultsState({ loading: false, error: true, open: 0, last30d: 0 });
      }

      if (inspectionsResult.status === "fulfilled") {
        const listResult = inspectionsResult.value;
        const reports = listResult.reports.map(mapMasterInspectorReportListItemToRecord);
        const preparedByDocumentId = buildPreparedStagesFromInspectorListResponse({
          notifications: listResult.notifications,
          preparedLetterStages: listResult.preparedLetterStages,
        });
        const elevatorLabelByReportId: Record<string, string> = {};
        for (const report of reports) {
          elevatorLabelByReportId[report.id] = report.elevator_id?.trim() || "—";
        }
        const alerts = computeInspectorFollowUpAlerts({
          reports,
          preparedByDocumentId,
          elevatorLabelByReportId,
        });
        setInspectionsState({
          loading: false,
          error: false,
          followUp: alerts.length,
        });
      } else {
        setInspectionsState({ loading: false, error: true, followUp: 0 });
      }

      if (documentsResult.status === "fulfilled") {
        setDocumentsState({
          loading: false,
          error: false,
          count: documentsResult.value.length,
        });
      } else {
        setDocumentsState({ loading: false, error: true, count: 0 });
      }

      if (paymentsResult.status === "fulfilled" && cloudRow) {
        const summary = computeProjectFinancialSummary(
          cloudRow.order_amount,
          paymentsResult.value.payments.map((p) => p.amount),
          cloudRow.next_payment_date
        );
        setFinancialState({
          loading: false,
          error: false,
          order: cloudRow.order_amount,
          paid: summary.paidTotal,
          balance: summary.balance,
          status: summary.collectionStatus,
        });
      } else {
        setFinancialState({
          loading: false,
          error: true,
          order: cloudRow?.order_amount ?? null,
          paid: 0,
          balance: null,
          status: "לא הוגדר",
        });
      }
    }

    void loadKpis();

    return () => {
      cancelled = true;
    };
  }, [buildingId, cloudReady, cloudRow]);

  const showTasks = isTabAllowedForProjectType(projectType, "tasks");
  const showFaults = isTabAllowedForProjectType(projectType, "faults");
  const showInspections = isTabAllowedForProjectType(projectType, "inspections");
  const showDocuments = isTabAllowedForProjectType(projectType, "documents");
  const showFinances = isTabAllowedForProjectType(projectType, "finances");
  const showExecution = isTabAllowedForProjectType(projectType, "execution");

  return (
    <ForteV2Panel className="mb-4">
      <h3 className="text-sm font-bold text-forte-text mb-3">תמונת מצב</h3>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {showExecution ? (
          <KpiCard label="שלב ביצוע" href={tabHref("execution")}>
            <p className="text-sm font-semibold text-forte-text line-clamp-2">{stageLabel}</p>
          </KpiCard>
        ) : null}

        {showExecution ? (
          <KpiCard label="התקדמות" href={tabHref("execution")}>
            <p className="text-sm font-semibold text-forte-text">
              {progressPercent == null ? "—" : `${progressPercent}%`}
            </p>
            {progressPercent != null ? (
              <div
                className="mt-2 h-1.5 rounded-full bg-forte-border/60 overflow-hidden"
                role="progressbar"
                aria-valuenow={progressPercent}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div
                  className="h-full bg-forte-primary transition-all"
                  style={{ width: `${Math.min(100, Math.max(0, progressPercent))}%` }}
                />
              </div>
            ) : null}
          </KpiCard>
        ) : null}

        {showTasks ? (
          <KpiCard
            label="משימות פתוחות"
            href={tabHref("tasks")}
            loading={tasksState.loading}
            error={tasksState.error}
          >
            <p className="text-2xl font-bold text-forte-text">{tasksState.open}</p>
          </KpiCard>
        ) : null}

        {showFaults ? (
          <KpiCard
            label="תקלות פתוחות"
            href={tabHref("faults")}
            loading={faultsState.loading}
            error={faultsState.error}
          >
            <p className="text-2xl font-bold text-forte-text">{faultsState.open}</p>
          </KpiCard>
        ) : null}

        {showInspections ? (
          <KpiCard
            label="בדיקות / follow-up"
            href={tabHref("inspections")}
            loading={inspectionsState.loading}
            error={inspectionsState.error}
          >
            <p className="text-2xl font-bold text-forte-text">{inspectionsState.followUp}</p>
            <p className="text-[11px] text-forte-text-secondary mt-0.5">דורשות טיפול</p>
          </KpiCard>
        ) : null}

        {showDocuments ? (
          <KpiCard
            label="מסמכים"
            href={tabHref("documents")}
            loading={documentsState.loading}
            error={documentsState.error}
          >
            <p className="text-2xl font-bold text-forte-text">{documentsState.count}</p>
          </KpiCard>
        ) : null}

        {showFinances ? (
          <KpiCard
            label="כספים"
            href={tabHref("finances")}
            loading={financialState.loading}
            error={financialState.error}
          >
            <p className="text-xs text-forte-text-secondary">
              הזמנה:{" "}
              <span className="font-semibold text-forte-text">
                {formatMoney(financialState.order)}
              </span>
            </p>
            <p className="text-xs text-forte-text-secondary mt-1">
              שולם:{" "}
              <span className="font-semibold text-forte-text">
                {formatMoney(financialState.paid)}
              </span>
            </p>
            <p className="text-xs text-forte-text-secondary mt-1">
              יתרה:{" "}
              <span className="font-semibold text-forte-text">
                {financialState.balance == null ? "—" : formatMoney(financialState.balance)}
              </span>
            </p>
            <div className="mt-1.5">
              <ForteV2StatusBadge tone={collectionStatusTone(financialState.status)}>
                {financialState.status}
              </ForteV2StatusBadge>
            </div>
          </KpiCard>
        ) : null}

        {showFaults ? (
          <KpiCard
            label="תקלות (30 יום)"
            href={tabHref("faults")}
            loading={faultsState.loading}
            error={faultsState.error}
          >
            <p className="text-2xl font-bold text-forte-text">{faultsState.last30d}</p>
          </KpiCard>
        ) : null}
      </div>
    </ForteV2Panel>
  );
}
