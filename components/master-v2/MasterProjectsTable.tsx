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
import { isProjectCompletedStage } from "@/lib/project-workflow";

interface MasterProjectsTableProps {
  rows: MasterProjectTableRow[];
  loading: boolean;
  onRowClick: (buildingId: string) => void;
  projectNumberSort: ProjectNumberSortDirection | null;
  onProjectNumberSortClick: () => void;
}

function projectStageTone(value: string): "blue" | "neutral" {
  if (value === "—" || isProjectCompletedStage(value)) return "neutral";
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
            <th>סוג</th>
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
              <td className="text-forte-text/85">
                {row.projectTypeLabel ? (
                  <ForteV2StatusBadge tone="blue">{row.projectTypeLabel}</ForteV2StatusBadge>
                ) : (
                  "—"
                )}
              </td>
              <td className="text-forte-text/85">{row.stage}</td>
              <td>
                <ForteV2StatusBadge tone={projectStageTone(row.projectStage)}>
                  {row.projectStage}
                </ForteV2StatusBadge>
              </td>
              <td>
                <div className="min-w-[8rem] space-y-1">
                  <div className="text-xs font-semibold text-forte-primary whitespace-nowrap">
                    {row.progress == null ? "—" : `${row.progress}%`}
                    {row.projectStage && row.projectStage !== "—" && (
                      <span className="text-forte-text-secondary font-normal">
                        {" "}
                        — {row.projectStage}
                      </span>
                    )}
                  </div>
                  {row.progress != null && (
                    <div
                      className="h-1.5 rounded-full bg-forte-border/60 overflow-hidden"
                      role="progressbar"
                      aria-valuenow={row.progress}
                      aria-valuemin={0}
                      aria-valuemax={100}
                    >
                      <div
                        className="h-full bg-forte-primary"
                        style={{
                          width: `${Math.min(100, Math.max(0, row.progress))}%`,
                        }}
                      />
                    </div>
                  )}
                </div>
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
