export const BUILDING_CLIENT_UPDATES_TABLE = "building_client_updates";
export const BUILDING_CLIENT_UPDATE_READS_TABLE = "building_client_update_reads";

export const CLIENT_UPDATE_TYPES = [
  { id: "elevator_company_outreach", label: "פנייה לחברת המעליות" },
  { id: "letter", label: "מכתב" },
  { id: "fault", label: "תקלה" },
  { id: "quote", label: "הצעת מחיר" },
  { id: "inspection", label: "בדיקה" },
  { id: "treatment", label: "טיפול" },
  { id: "document", label: "מסמך" },
  { id: "general", label: "עדכון כללי" },
] as const;

export type ClientUpdateTypeId = (typeof CLIENT_UPDATE_TYPES)[number]["id"];

export const CLIENT_UPDATE_STATUSES = [
  { id: "for_information", label: "לידיעה" },
  { id: "in_progress", label: "בטיפול" },
  { id: "awaiting_response", label: "ממתינים לתגובה" },
  { id: "response_received", label: "התקבלה תשובה" },
  { id: "completed", label: "הושלם" },
] as const;

export type ClientUpdateStatusId = (typeof CLIENT_UPDATE_STATUSES)[number]["id"];

const UPDATE_TYPE_IDS = new Set<string>(CLIENT_UPDATE_TYPES.map((t) => t.id));
const UPDATE_STATUS_IDS = new Set<string>(CLIENT_UPDATE_STATUSES.map((s) => s.id));

export function isClientUpdateTypeId(value: string): value is ClientUpdateTypeId {
  return UPDATE_TYPE_IDS.has(value);
}

export function isClientUpdateStatusId(value: string): value is ClientUpdateStatusId {
  return UPDATE_STATUS_IDS.has(value);
}

export function getClientUpdateTypeLabel(typeId: string): string {
  return CLIENT_UPDATE_TYPES.find((t) => t.id === typeId)?.label ?? typeId;
}

export function getClientUpdateStatusLabel(statusId: string): string {
  return CLIENT_UPDATE_STATUSES.find((s) => s.id === statusId)?.label ?? statusId;
}

export interface BuildingClientUpdateRecord {
  id: string;
  building_id: string;
  project_number: string | null;
  title: string;
  body: string;
  update_type: ClientUpdateTypeId;
  status: ClientUpdateStatusId;
  visible_to_client: boolean;
  document_id: string | null;
  published_at: string;
  created_at: string;
  updated_at: string;
}

export interface MasterBuildingClientUpdateReadDto {
  clientUserId: string;
  clientUserName: string;
  readAt: string | null;
}

export interface MasterBuildingClientUpdateDto {
  id: string;
  buildingId: string;
  projectNumber: string | null;
  title: string;
  body: string;
  updateType: ClientUpdateTypeId;
  updateTypeLabel: string;
  status: ClientUpdateStatusId;
  statusLabel: string;
  visibleToClient: boolean;
  documentId: string | null;
  attachmentTitle: string | null;
  publishedAt: string;
  createdAt: string;
  updatedAt: string;
  readBy: MasterBuildingClientUpdateReadDto[];
}

export interface ClientBuildingClientUpdateDto {
  id: string;
  title: string;
  body: string;
  updateType: ClientUpdateTypeId;
  updateTypeLabel: string;
  status: ClientUpdateStatusId;
  statusLabel: string;
  publishedAt: string;
  isRead: boolean;
  readAt: string | null;
  hasAttachment: boolean;
  attachmentDocumentId: string | null;
  attachmentTitle: string | null;
}

/** Document link rules for updates (no public URL in API). */
export function isDocumentEligibleForClientUpdateLink(input: {
  documentBuildingId: string;
  updateBuildingId: string;
  visibility: string;
}): boolean {
  const docBuilding = input.documentBuildingId.trim().toLowerCase();
  const updateBuilding = input.updateBuildingId.trim().toLowerCase();
  if (!docBuilding || !updateBuilding || docBuilding !== updateBuilding) {
    return false;
  }
  return input.visibility === "client";
}
