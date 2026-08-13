"use client";

import { useMemo, useState } from "react";
import MasterProjectsTable from "@/components/master-v2/MasterProjectsTable";
import {
  buildMasterProjectTableRow,
  projectUpdatedYear,
} from "@/components/master-v2/master-v2-project-rows";
import {
  ForteV2FilterPill,
  ForteV2GhostButton,
  ForteV2PageHeader,
  ForteV2PrimaryButton,
  ForteV2SearchField,
  ForteV2SecondaryButton,
  ForteV2ToolbarCard,
  ForteV2ToolbarDivider,
  ForteV2ToolbarRow,
} from "@/components/master-v2/project-v2/MasterProjectV2Workspace";
import type { MasterBuildingEntry } from "@/lib/master-buildings-list";
import type { BuildingDossier } from "@/lib/master-building-dossier";
import { PROJECT_STAGE_OPTIONS } from "@/lib/buildings-cloud";
import { MASTER_PROJECT_V2_NEW_PATH } from "@/lib/master-project-v2-routes";

interface MasterProjectsViewProps {
  entries: MasterBuildingEntry[];
  dossierByBuildingId: Map<string, BuildingDossier>;
  loading: boolean;
  onRefresh: () => void;
  onRowClick: (buildingId: string) => void;
}

const STAGE_OPTIONS = ["הכל", "שימוש אמיתי", "פיילוט", "דמו", "מדיווחים"];
const STATUS_OPTIONS = ["הכל", ...PROJECT_STAGE_OPTIONS];

export default function MasterProjectsView({
  entries,
  dossierByBuildingId,
  loading,
  onRefresh,
  onRowClick,
}: MasterProjectsViewProps) {
  const [search, setSearch] = useState("");
  const [clientFilter, setClientFilter] = useState("הכל");
  const [cityFilter, setCityFilter] = useState("הכל");
  const [stageFilter, setStageFilter] = useState("הכל");
  const [statusFilter, setStatusFilter] = useState("הכל");
  const [yearFilter, setYearFilter] = useState("הכל");

  const tableRows = useMemo(() => {
    return entries.map((entry) =>
      buildMasterProjectTableRow(
        entry,
        dossierByBuildingId.get(entry.buildingId)?.lastFaultDate
      )
    );
  }, [entries, dossierByBuildingId]);

  const clientOptions = useMemo(() => {
    const values = new Set<string>();
    for (const row of tableRows) {
      if (row.client !== "—") values.add(row.client);
    }
    return ["הכל", ...Array.from(values).sort((a, b) => a.localeCompare(b, "he"))];
  }, [tableRows]);

  const cityOptions = useMemo(() => {
    const values = new Set<string>();
    for (const row of tableRows) {
      if (row.city !== "—") values.add(row.city);
    }
    return ["הכל", ...Array.from(values).sort((a, b) => a.localeCompare(b, "he"))];
  }, [tableRows]);

  const yearOptions = useMemo(() => {
    const values = new Set<number>();
    for (const row of tableRows) {
      const year = projectUpdatedYear(row.updatedAt);
      if (year) values.add(year);
    }
    return ["הכל", ...Array.from(values).sort((a, b) => b - a).map(String)];
  }, [tableRows]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tableRows.filter((row) => {
      if (clientFilter !== "הכל" && row.client !== clientFilter) return false;
      if (cityFilter !== "הכל" && row.city !== cityFilter) return false;
      if (stageFilter !== "הכל" && row.stage !== stageFilter) return false;
      if (statusFilter !== "הכל" && row.projectStage !== statusFilter) return false;
      if (yearFilter !== "הכל") {
        const year = projectUpdatedYear(row.updatedAt);
        if (!year || String(year) !== yearFilter) return false;
      }
      if (!q) return true;
      const haystack = [
        row.buildingId,
        row.buildingName,
        row.client,
        row.city,
        row.stage,
        row.projectStage,
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [
    tableRows,
    search,
    clientFilter,
    cityFilter,
    stageFilter,
    statusFilter,
    yearFilter,
  ]);

  const hasActiveFilters =
    clientFilter !== "הכל" ||
    cityFilter !== "הכל" ||
    stageFilter !== "הכל" ||
    statusFilter !== "הכל" ||
    yearFilter !== "הכל" ||
    search.trim() !== "";

  function resetFilters() {
    setSearch("");
    setClientFilter("הכל");
    setCityFilter("הכל");
    setStageFilter("הכל");
    setStatusFilter("הכל");
    setYearFilter("הכל");
  }

  return (
    <div className="fv2-page-body">
      <ForteV2PageHeader
        title="ניהול פרויקטים"
        subtitle="ממשק מרכזי לניהול, מעקב ופתיחת תיקי פרויקט"
        actions={
          <ForteV2PrimaryButton href={MASTER_PROJECT_V2_NEW_PATH}>
            + פרויקט חדש
          </ForteV2PrimaryButton>
        }
      />

      <ForteV2ToolbarCard>
        <ForteV2ToolbarRow>
          <ForteV2SearchField
            value={search}
            onChange={setSearch}
            placeholder="חיפוש לפי מספר פרויקט, שם בניין, לקוח או עיר..."
          />
          <ForteV2ToolbarDivider />
          <ForteV2FilterPill
            label="לקוח"
            value={clientFilter}
            options={clientOptions}
            onChange={setClientFilter}
          />
          <ForteV2FilterPill
            label="עיר"
            value={cityFilter}
            options={cityOptions}
            onChange={setCityFilter}
          />
          <ForteV2FilterPill
            label="שלב"
            value={stageFilter}
            options={STAGE_OPTIONS}
            onChange={setStageFilter}
          />
          <ForteV2FilterPill
            label="שלב פרויקט"
            value={statusFilter}
            options={STATUS_OPTIONS}
            onChange={setStatusFilter}
          />
          <ForteV2FilterPill
            label="שנה"
            value={yearFilter}
            options={yearOptions}
            onChange={setYearFilter}
          />
          {hasActiveFilters && (
            <ForteV2GhostButton onClick={resetFilters}>איפוס מסננים</ForteV2GhostButton>
          )}
          <div className="flex-1" />
          <ForteV2SecondaryButton onClick={onRefresh} disabled={loading} size="sm">
            {loading ? "טוען..." : "↻ רענון"}
          </ForteV2SecondaryButton>
        </ForteV2ToolbarRow>
      </ForteV2ToolbarCard>

      <MasterProjectsTable
        rows={filteredRows}
        loading={loading}
        onRowClick={onRowClick}
      />
    </div>
  );
}
