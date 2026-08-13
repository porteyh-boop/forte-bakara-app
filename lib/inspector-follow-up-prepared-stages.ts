import { getDocumentById, type DocumentRecord } from "./document-center";
import {
  getPreparedInspectorLetterStages,
  groupPreparedLetterStagesByDocumentId,
  recordInspectorLetterPrepared,
  type DocumentInspectorNotificationRecord,
  type InspectorLetterStage,
} from "./document-inspector-notifications";
import { parseMasterLetterMetadata } from "./master-letter-metadata";
import { MASTER_LETTER_TAG } from "./master-letters";
import type { InspectorReportRecord } from "./inspector-report-tracking";

export function resolveInspectorReportTrackingId(
  report: Pick<InspectorReportRecord, "id" | "document_id">
): string {
  return report.document_id ?? report.id;
}

function isInspectorLetterStageValue(
  value: string
): value is InspectorLetterStage {
  return value === "letter_1" || value === "letter_2" || value === "letter_3";
}

export function groupPreparedLetterStagesFromSavedLetters(
  documents: DocumentRecord[]
): Record<string, Set<InspectorLetterStage>> {
  const grouped: Record<string, Set<InspectorLetterStage>> = {};

  for (const document of documents) {
    if (!document.tags?.includes(MASTER_LETTER_TAG)) continue;

    const metadata = parseMasterLetterMetadata(document);
    const followUp = metadata?.inspectorFollowUp;
    if (!followUp) continue;

    const reportId = followUp.reportDocumentId.trim();
    if (!reportId || !isInspectorLetterStageValue(followUp.letterStage)) continue;

    const current = grouped[reportId] ?? new Set<InspectorLetterStage>();
    current.add(followUp.letterStage);
    grouped[reportId] = current;
  }

  return grouped;
}

export function mergePreparedLetterStageMaps(
  ...maps: Array<Record<string, ReadonlySet<InspectorLetterStage>>>
): Record<string, Set<InspectorLetterStage>> {
  const merged: Record<string, Set<InspectorLetterStage>> = {};

  for (const map of maps) {
    for (const [reportId, stages] of Object.entries(map)) {
      const current = merged[reportId] ?? new Set<InspectorLetterStage>();
      for (const stage of stages) {
        current.add(stage);
      }
      merged[reportId] = current;
    }
  }

  return merged;
}

export function buildPreparedStagesByReportTrackingId(input: {
  notifications: DocumentInspectorNotificationRecord[];
  savedLetters: DocumentRecord[];
}): Record<string, Set<InspectorLetterStage>> {
  return mergePreparedLetterStageMaps(
    groupPreparedLetterStagesByDocumentId(input.notifications),
    groupPreparedLetterStagesFromSavedLetters(input.savedLetters)
  );
}

export function getPreparedStagesForReport(
  report: Pick<InspectorReportRecord, "id" | "document_id">,
  preparedByReportTrackingId: Record<string, ReadonlySet<InspectorLetterStage>>
): Set<InspectorLetterStage> {
  const trackingId = resolveInspectorReportTrackingId(report);
  return new Set(preparedByReportTrackingId[trackingId] ?? []);
}

export function getPreparedStagesForReportId(
  reportTrackingId: string,
  notifications: DocumentInspectorNotificationRecord[],
  savedLetters: DocumentRecord[]
): Set<InspectorLetterStage> {
  const fromNotifications = getPreparedInspectorLetterStages(
    notifications.filter((row) => row.document_id === reportTrackingId)
  );
  const fromLetters =
    groupPreparedLetterStagesFromSavedLetters(savedLetters)[reportTrackingId] ??
    new Set<InspectorLetterStage>();

  return mergePreparedLetterStageMaps(
    { [reportTrackingId]: fromNotifications },
    { [reportTrackingId]: fromLetters }
  )[reportTrackingId] ?? new Set<InspectorLetterStage>();
}

export async function isDocumentBasedInspectorReportId(
  reportDocumentId: string
): Promise<boolean> {
  const document = await getDocumentById(reportDocumentId);
  return document?.document_type === "inspector_report";
}

export async function recordInspectorLetterPreparedIfDocumentBased(input: {
  reportDocumentId: string;
  letterStage: InspectorLetterStage;
}): Promise<void> {
  const isDocumentBased = await isDocumentBasedInspectorReportId(
    input.reportDocumentId
  );
  if (!isDocumentBased) return;

  await recordInspectorLetterPrepared({
    documentId: input.reportDocumentId,
    letterStage: input.letterStage,
  });
}
