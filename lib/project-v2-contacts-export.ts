import type { ProjectContactWithDetails } from "@/lib/contacts";

function escapeCsv(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function exportProjectContactsToCsv(
  contacts: ProjectContactWithDetails[],
  buildingId: string
): void {
  if (typeof window === "undefined") return;

  const headers = [
    "שם",
    "תפקיד",
    "חברה",
    "תפקיד בפרויקט",
    "טלפון",
    'דוא"ל',
    "ראשי",
  ];
  const rows = contacts.map((contact) =>
    [
      contact.fullName,
      contact.roleTitle ?? "",
      contact.company ?? "",
      contact.projectRole ?? "",
      contact.phone ?? "",
      contact.email ?? "",
      contact.isPrimary ? "כן" : "לא",
    ]
      .map(escapeCsv)
      .join(",")
  );

  const csv = `\uFEFF${headers.join(",")}\n${rows.join("\n")}`;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `contacts-${buildingId}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

/** @deprecated Use exportProjectContactsToCsv */
export function exportBuildingContactsToCsv(
  contacts: ProjectContactWithDetails[],
  buildingId: string
): void {
  exportProjectContactsToCsv(contacts, buildingId);
}
