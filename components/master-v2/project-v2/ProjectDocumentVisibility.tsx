"use client";

import {
  getDocumentVisibilityBadgeLabel,
  type DocumentRecord,
  type DocumentVisibility,
} from "@/lib/document-center";

export function projectDocumentVisibilityBadgeClass(
  visibility: DocumentVisibility
): string {
  return visibility === "client"
    ? "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 whitespace-nowrap"
    : "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold bg-slate-50 text-slate-700 border border-slate-200 whitespace-nowrap";
}

export function ProjectDocumentVisibilityBadge({
  visibility,
}: {
  visibility: DocumentVisibility;
}) {
  return (
    <span className={projectDocumentVisibilityBadgeClass(visibility)}>
      {getDocumentVisibilityBadgeLabel(visibility)}
    </span>
  );
}

export function ProjectDocumentVisibilityUploadField({
  value,
  onChange,
  name = "documentVisibility",
}: {
  value: DocumentVisibility;
  onChange: (value: DocumentVisibility) => void;
  name?: string;
}) {
  return (
    <fieldset className="space-y-1.5">
      <legend className="text-xs text-forte-text-secondary">הרשאת מסמך</legend>
      <div className="flex flex-wrap gap-4 text-xs text-forte-text">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            name={name}
            value="internal"
            checked={value === "internal"}
            onChange={() => onChange("internal")}
          />
          <span>פנימי</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            name={name}
            value="client"
            checked={value === "client"}
            onChange={() => onChange("client")}
          />
          <span>גלוי ללקוח</span>
        </label>
      </div>
    </fieldset>
  );
}

export function ProjectDocumentVisibilityToggle({
  document,
  disabled,
  onToggle,
}: {
  document: DocumentRecord;
  disabled?: boolean;
  onToggle: (document: DocumentRecord, next: DocumentVisibility) => void;
}) {
  const nextVisibility: DocumentVisibility =
    document.visibility === "client" ? "internal" : "client";
  const label =
    document.visibility === "client" ? "הפוך לפנימי" : "פרסם ללקוח";

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onToggle(document, nextVisibility)}
      className="text-[11px] text-forte-primary hover:underline disabled:opacity-40 whitespace-nowrap"
    >
      {label}
    </button>
  );
}

export async function confirmDocumentVisibilityChange(
  nextVisibility: DocumentVisibility
): Promise<boolean> {
  if (nextVisibility === "client") {
    return window.confirm("האם לפרסם את המסמך ללקוח בפורטל?");
  }
  return window.confirm("האם להפוך את המסמך לפנימי?");
}
