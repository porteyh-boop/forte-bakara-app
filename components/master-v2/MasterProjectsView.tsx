"use client";

import { useMemo, useState } from "react";
import MasterProjectsTable from "@/components/master-v2/MasterProjectsTable";
import {
  buildMasterProjectTableRow,
  projectUpdatedYear,
  sortMasterProjectTableRowsByProjectNumber,
  type ProjectNumberSortDirection,
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
import { MASTER_PROJECT_V2_NEW_PATH } from "@/lib/master-project-v2-routes";
import {
  SERVICE_TYPE_FILTER_OPTIONS,
  serviceTypeMatchesFilter,
  serviceTypeSearchHaystack,
} from "@/lib/service-type";

interface MasterProjectsViewProps {
  entries: MasterBuildingEntry[];
  dossierByBuildingId: Map<string, BuildingDossier>;
  loading: boolean;
  onRefresh: () => void;
  onRowClick: (buildingId: string) => void;
}

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
  const [serviceTypeFilter, setServiceTypeFilter] = useState("הכל");
  const [yearFilter, setYearFilter] = useState("הכל");
  const [projectNumberSort, setProjectNumberSort] =
    useState<ProjectNumberSortDirection | null>(null);

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
      if (
        serviceTypeFilter !== "הכל" &&
        !serviceTypeMatchesFilter(serviceTypeFilter, row.serviceType)
      ) {
        return false;
      }
      if (yearFilter !== "הכל") {
        const year = projectUpdatedYear(row.updatedAt);
        if (!year || String(year) !== yearFilter) return false;
      }
      if (!q) return true;
      const haystack = [
        row.buildingId,
        row.projectNumber,
        row.buildingName,
        row.client,
        row.city,
        serviceTypeSearchHaystack(row.serviceType, row.serviceTypeOther),
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
    serviceTypeFilter,
    yearFilter,
  ]);

  const displayedRows = useMemo(() => {
    if (!projectNumberSort) return filteredRows;
    return sortMasterProjectTableRowsByProjectNumber(
      filteredRows,
      projectNumberSort
    );
  }, [filteredRows, projectNumberSort]);

  function toggleProjectNumberSort() {
    setProjectNumberSort((prev) => {
      if (prev === null) return "asc";
      return prev === "asc" ? "desc" : "asc";
    });
  }

  const hasActiveFilters =
    clientFilter !== "הכל" ||
    cityFilter !== "הכל" ||
    serviceTypeFilter !== "הכל" ||
    yearFilter !== "הכל" ||
    search.trim() !== "";

  function resetFilters() {
    setSearch("");
    setClientFilter("הכל");
    setCityFilter("הכל");
    setServiceTypeFilter("הכל");
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
            placeholder="חיפוש לפי מספר פרויקט, שם בניין, לקוח, עיר או סוג שירות..."
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
            label="סוג שירות"
            value={serviceTypeFilter}
            options={[...SERVICE_TYPE_FILTER_OPTIONS]}
            onChange={setServiceTypeFilter}
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
        rows={displayedRows}
        loading={loading}
        onRowClick={onRowClick}
        projectNumberSort={projectNumberSort}
        onProjectNumberSortClick={toggleProjectNumberSort}
      />
    </div>
  );
}
