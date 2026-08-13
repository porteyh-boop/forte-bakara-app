import {
  documentHasTagFilter,
  type DocumentRecord,
  type DocumentTypeId,
} from "./document-center";
import { MASTER_LETTER_TAG } from "./master-letters";

/** Project V2 areas that embed integrated documents. */
export const PROJECT_V2_DOCUMENT_SECTIONS = [
  "details",
  "inspections",
  "faults",
] as const;

export type ProjectV2DocumentSection =
  (typeof PROJECT_V2_DOCUMENT_SECTIONS)[number];

export const PROJECT_V2_SECTION_TAG_PREFIX = "v2-section:";

export function getProjectV2SectionTag(
  section: ProjectV2DocumentSection
): string {
  return `${PROJECT_V2_SECTION_TAG_PREFIX}${section}`;
}

export function parseProjectV2SectionTag(
  tags: string[]
): ProjectV2DocumentSection | null {
  for (const tag of tags) {
    if (!tag.startsWith(PROJECT_V2_SECTION_TAG_PREFIX)) continue;
    const section = tag.slice(PROJECT_V2_SECTION_TAG_PREFIX.length);
    if (isProjectV2DocumentSection(section)) return section;
  }
  return null;
}

export function isProjectV2DocumentSection(
  value: string
): value is ProjectV2DocumentSection {
  return PROJECT_V2_DOCUMENT_SECTIONS.includes(
    value as ProjectV2DocumentSection
  );
}

export interface ProjectV2SectionUploadDefaults {
  documentType: DocumentTypeId;
  defaultTags: string[];
  title: string;
  description: string;
}

export const PROJECT_V2_SECTION_UPLOAD_DEFAULTS: Record<
  ProjectV2DocumentSection,
  ProjectV2SectionUploadDefaults
> = {
  details: {
    documentType: "correspondence",
    defaultTags: ["התכתבויות"],
    title: "מסמכים",
    description: "כל מסמכי תיק הבניין",
  },
  inspections: {
    documentType: "inspector_report",
    defaultTags: ["תסקיר בודק"],
    title: "מסמכים",
    description: "מסמכי בדיקות ותסקירי בודק",
  },
  faults: {
    documentType: "maintenance",
    defaultTags: ["דוח תקלה"],
    title: "מסמכים",
    description: "מסמכי תקלות ודוחות שירות",
  },
};

const INSPECTION_LEGACY_TAGS = [
  "תסקיר בודק",
  "הערות בודק",
  "אישור בודק",
] as const;

const FAULT_LEGACY_TAGS = ["דוח תקלה", "דוח שירות"] as const;

export function isProjectV2LetterDocument(document: DocumentRecord): boolean {
  return documentHasTagFilter(document.tags, MASTER_LETTER_TAG);
}

function matchesInspectionLegacy(
  document: DocumentRecord,
  inspectorMetaDocumentIds: ReadonlySet<string>
): boolean {
  if (document.document_type === "inspector_report") return true;
  if (inspectorMetaDocumentIds.has(document.id)) return true;
  return INSPECTION_LEGACY_TAGS.some((tag) =>
    documentHasTagFilter(document.tags, tag)
  );
}

function matchesFaultLegacy(document: DocumentRecord): boolean {
  return FAULT_LEGACY_TAGS.some((tag) =>
    documentHasTagFilter(document.tags, tag)
  );
}

/** Full building dossier — every project document, including letters. */
export function isProjectV2BuildingDossierDocument(
  _document: DocumentRecord
): boolean {
  return true;
}

/** Professional inspections view — subset of the building dossier. */
export function isProjectV2InspectionDocument(
  document: DocumentRecord,
  inspectorMetaDocumentIds: ReadonlySet<string> = new Set()
): boolean {
  if (parseProjectV2SectionTag(document.tags) === "inspections") return true;
  if (isProjectV2LetterDocument(document)) return false;
  return matchesInspectionLegacy(document, inspectorMetaDocumentIds);
}

/** Professional faults view — subset of the building dossier. */
export function isProjectV2FaultDocument(document: DocumentRecord): boolean {
  if (parseProjectV2SectionTag(document.tags) === "faults") return true;
  if (isProjectV2LetterDocument(document)) return false;
  return matchesFaultLegacy(document);
}

export function buildProjectV2UploadTags(
  section: ProjectV2DocumentSection
): string[] {
  const defaults = PROJECT_V2_SECTION_UPLOAD_DEFAULTS[section];
  const tags = new Set<string>(defaults.defaultTags);
  if (section !== "details") {
    tags.add(getProjectV2SectionTag(section));
  }
  return Array.from(tags);
}

/** Tags for supplementary inspection documents (not primary inspector reports). */
export function buildProjectV2AdditionalInspectionUploadTags(): string[] {
  return [getProjectV2SectionTag("inspections")];
}

export function isPrimaryInspectorReportDocument(
  document: DocumentRecord,
  inspectorMetaDocumentIds: ReadonlySet<string>
): boolean {
  return inspectorMetaDocumentIds.has(document.id);
}

export function filterAdditionalInspectionDocuments(
  documents: DocumentRecord[],
  buildingId: string,
  inspectorMetaDocumentIds: ReadonlySet<string> = new Set()
): DocumentRecord[] {
  return filterDocumentsForProjectV2Section(
    documents,
    buildingId,
    "inspections",
    inspectorMetaDocumentIds
  ).filter(
    (document) =>
      !isPrimaryInspectorReportDocument(document, inspectorMetaDocumentIds)
  );
}

/**
 * Filters documents for a Project V2 view.
 * - details: full building dossier (superset)
 * - inspections / faults: professional subsets of the same documents
 */
export function filterDocumentsForProjectV2Section(
  documents: DocumentRecord[],
  buildingId: string,
  section: ProjectV2DocumentSection,
  inspectorMetaDocumentIds: ReadonlySet<string> = new Set()
): DocumentRecord[] {
  const normalizedBuilding = buildingId.trim().toLowerCase();
  return documents.filter((document) => {
    if (document.building_id.trim().toLowerCase() !== normalizedBuilding) {
      return false;
    }

    switch (section) {
      case "details":
        return isProjectV2BuildingDossierDocument(document);
      case "inspections":
        return isProjectV2InspectionDocument(
          document,
          inspectorMetaDocumentIds
        );
      case "faults":
        return isProjectV2FaultDocument(document);
      default:
        return false;
    }
  });
}
