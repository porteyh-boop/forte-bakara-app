import type { MasterLetterRecipientSnapshot } from "../master-letter-metadata";

export function formatRecipientSnapshotLines(
  snapshot: MasterLetterRecipientSnapshot,
  options?: { includeLekavodLabel?: boolean }
): string[] {
  const lines: string[] = [];
  const includeLekavodLabel = options?.includeLekavodLabel ?? false;

  if (includeLekavodLabel) {
    lines.push("לכבוד:");
  }

  if (snapshot.fullName.trim()) {
    lines.push(snapshot.fullName.trim());
  }

  if (snapshot.company?.trim()) {
    lines.push(snapshot.company.trim());
  }

  if (snapshot.roleTitle?.trim()) {
    lines.push(snapshot.roleTitle.trim());
  }

  if (lines.length === 0 || (lines.length === 1 && lines[0] === "לכבוד:")) {
    const fallback = snapshot.addresseeLine.replace(/^לכבוד\s+/, "").trim();
    if (fallback) {
      if (includeLekavodLabel && lines.length === 1) {
        lines.push(fallback);
      } else if (!includeLekavodLabel) {
        lines.push(fallback);
      }
    }
  }

  return lines.filter(Boolean);
}

export function formatCcSnapshotLine(snapshot: MasterLetterRecipientSnapshot): string {
  const name = snapshot.fullName.trim();
  const company = snapshot.company?.trim() ?? "";
  if (name && company) return `${name} — ${company}`;
  return name || company || snapshot.addresseeLine.replace(/^לכבוד\s+/, "").trim();
}
