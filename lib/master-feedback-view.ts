export function getMasterFeedbackEmptyMessage(
  totalCount: number,
  filteredCount: number,
  cloudReady: boolean
): string {
  if (!cloudReady) return "Supabase לא מחובר";
  if (totalCount === 0) return "אין משובים בענן";
  if (filteredCount === 0) {
    return `יש ${totalCount} משובים בענן, אך אין תוצאות לאחר הסינון. נסו "כל הבניינים" או נקו את טווח התאריכים.`;
  }
  return "";
}

export function formatFeedbackNotes(
  unclearOrMissing: string,
  expectedFeature: string
): string {
  const parts: string[] = [];
  if (unclearOrMissing.trim()) {
    parts.push(`חסר/לא ברור: ${unclearOrMissing.trim()}`);
  }
  if (expectedFeature.trim()) {
    parts.push(`פעולה מצופה: ${expectedFeature.trim()}`);
  }
  return parts.length > 0 ? parts.join(" · ") : "—";
}
