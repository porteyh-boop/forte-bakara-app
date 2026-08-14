"use client";

import type {
  MasterProjectTableRow,
  ProjectNumberSortDirection,
} from "@/components/master-v2/master-v2-project-rows";
import { formatMasterProjectDate } from "@/components/master-v2/master-v2-project-rows";
import {
  ForteV2DataTable,
  ForteV2EmptyState,
  ForteV2StatusBadge,
  ForteV2TableCard,
} from "@/components/master-v2/project-v2/MasterProjectV2Workspace";

interface MasterProjectsTableProps {
  rows: MasterProjectTableRow[];
  loading: boolean;
  onRowClick: (buildingId: string) => void;
  projectNumberSort: ProjectNumberSortDirection | null;
  onProjectNumberSortClick: () => void;
}

function projectStageTone(value: string): "blue" | "neutral" {
  if (value === "—" || value === "פרויקט סגור") return "neutral";
  return "blue";
}

export default function MasterProjectsTable({
  rows,
  loading,
  onRowClick,
  projectNumberSort,
  onProjectNumberSortClick,
}: MasterProjectsTableProps) {
  if (loading && rows.length === 0) {
    return (
      <ForteV2TableCard title="רשימת פרויקטים">
        <div className="py-12 text-center text-sm text-forte-text-secondary">
          טוען פרויקטים...
        </div>
      </ForteV2TableCard>
    );
  }

  if (!loading && rows.length === 0) {
    return (
      <ForteV2TableCard title="רשימת פרויקטים" count={0}>
        <ForteV2EmptyState
          icon="▦"
          title="לא נמצאו פרויקטים"
          description="נסו לשנות את המסננים או ליצור פרויקט חדש."
        />
      </ForteV2TableCard>
    );
  }

  return (
    <ForteV2TableCard title="רשימת פרויקטים" count={rows.length}>
      <ForteV2DataTable>
        <thead>
          <tr>
            <th className="w-10" aria-hidden="true" />
            <th>
              <button
                type="button"
                onClick={onProjectNumberSortClick}
                className="inline-flex items-center gap-1 font-inherit text-inherit hover:text-forte-primary transition-colors cursor-pointer"
                aria-sort={
                  projectNumberSort === "asc"
                    ? "ascending"
                    : projectNumberSort === "desc"
                      ? "descending"
                      : "none"
                }
              >
                <span>מספר פרויקט</span>
                {projectNumberSort === "asc" && (
                  <span aria-hidden="true" className="text-forte-primary">
                    ↑
                  </span>
                )}
                {projectNumberSort === "desc" && (
                  <span aria-hidden="true" className="text-forte-primary">
                    ↓
                  </span>
                )}
              </button>
            </th>
            <th>שם הבניין</th>
            <th>לקוח</th>
            <th>עיר</th>
            <th>שלב נוכחי</th>
            <th>שלב הפרויקט</th>
            <th>התקדמות</th>
            <th>עודכן</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.buildingId}
              onClick={() => onRowClick(row.buildingId)}
              className="fv2-row-clickable"
            >
              <td className="text-forte-text-secondary/60 text-center">›</td>
              <td>
                <span className="fv2-cell-id" dir="ltr">
                  {row.projectNumber}
                </span>
              </td>
              <td>
                <span className="fv2-cell-name">{row.buildingName}</span>
              </td>
              <td className="text-forte-text/85">{row.client}</td>
              <td className="text-forte-text/85">{row.city}</td>
              <td className="text-forte-text/85">{row.stage}</td>
              <td>
                <ForteV2StatusBadge tone={projectStageTone(row.projectStage)}>
                  {row.projectStage}
                </ForteV2StatusBadge>
              </td>
              <td className="font-semibold text-forte-primary">
                {row.progress == null ? "—" : `${row.progress}%`}
              </td>
              <td className="text-forte-text-secondary whitespace-nowrap text-xs">
                {formatMasterProjectDate(row.updatedAt)}
              </td>
            </tr>
          ))}
        </tbody>
      </ForteV2DataTable>
    </ForteV2TableCard>
  );
}
