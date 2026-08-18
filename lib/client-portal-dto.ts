import type { ClientPermissionFlags } from "@/lib/client-permissions";
import type { ClientAccessLevel, ClientAccessSession } from "@/lib/client-access";
import type { StoredClientType } from "@/lib/client-profile";
import type { Elevator, Fault, FaultStatus, FaultType } from "@/lib/types";
import type { StatisticsFaultRow } from "@/lib/statistics";

export type ClientPortalGateError =
  | "invalid"
  | "deactivated"
  | "expired"
  | "access_denied"
  | "building_not_found";

export interface ClientPortalUserDto {
  id: string;
  name: string;
  welcomeMessage: string | null;
  clientType: StoredClientType | null;
}

export interface ClientPortalAccessDto {
  accessLevel: ClientAccessLevel;
  elevatorId: string | null;
}

export interface ClientPortalBuildingDto {
  id: string;
  name: string;
  buildingCode: string;
  liveStartedAt: string | null;
}

export interface ClientPortalDocumentDto {
  id: string;
  title: string;
  document_type: string;
  file_url: string | null;
  created_at: string;
}

export interface ClientPortalBootstrapDto {
  user: ClientPortalUserDto;
  access: ClientPortalAccessDto;
  permissions: ClientPermissionFlags;
  building: ClientPortalBuildingDto;
  elevators: Elevator[];
  faults: Fault[];
  documents: ClientPortalDocumentDto[];
  scopeLabel: string;
  dataLastUpdated: string | null;
}

export interface ClientPortalFaultSubmitInput {
  elevatorId: string;
  faultType: string;
  description: string;
  isDisabled?: boolean;
  ticketNumber?: string;
  imageData?: string | null;
  /** Ignored for authorization — server derives building from token. */
  buildingId?: string;
}

export interface ClientPortalFeedbackSubmitInput {
  senderName: string;
  senderRole: string;
  rating: number;
  wouldUseRegularly: string;
  unclearOrMissing: string;
  expectedFeature: string;
  wouldRecommend: string;
  buildingId?: string;
}

export interface ClientPortalActivityInput {
  actionType: string;
  actionDetails?: string | null;
}

export interface ClientPortalFaultSubmitResult {
  id: string;
  ticketNumber: string | null;
  status: FaultStatus;
  type: FaultType;
  description: string;
  elevatorId: string;
  elevatorName: string;
  reportedAt: string;
}

export interface ClientPortalStatisticsDto {
  rows: StatisticsFaultRow[];
}

export interface ClientPortalAuthContext {
  session: ClientAccessSession;
  permissions: ClientPermissionFlags;
  buildingId: string;
}
