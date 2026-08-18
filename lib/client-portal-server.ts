import { isAfterLiveStart } from "@/lib/building-live";
import {
  CLIENT_ACCESS_TABLE,
  CLIENT_USERS_TABLE,
  scopeElevatorsForClientAccess,
  scopeFaultsForClientAccess,
  type ClientAccessSession,
} from "@/lib/client-access";
import {
  CLIENT_ACTIVITY_LOG_TABLE,
  CLIENT_PERMISSIONS_TABLE,
  DEFAULT_CLIENT_PERMISSIONS,
  extractClientPermissionFlags,
  type ClientPermissionFlags,
  type ClientPermissionRecord,
} from "@/lib/client-permissions";
import { CLIENT_PORTAL_FAULT_SOURCE } from "@/lib/client-portal";
import {
  getDemoFaultsForPortalBuilding,
  resolveClientPortalBuilding,
} from "@/lib/client-portal-building";
import type {
  ClientPortalActivityInput,
  ClientPortalBootstrapDto,
  ClientPortalDocumentDto,
  ClientPortalFaultSubmitInput,
  ClientPortalFaultSubmitResult,
  ClientPortalFeedbackSubmitInput,
  ClientPortalStatisticsDto,
  ClientPortalAuthContext,
} from "@/lib/client-portal-dto";
import { normalizeBuildingId } from "@/lib/buildings-cloud";
import { computePortalDataLastUpdated } from "@/lib/client-profile";
import { resolveClientWelcomeMessage } from "@/lib/client-access";
import { buildFaultNotificationTelegramMessage } from "@/lib/fault-notification-messages";
import {
  shouldDispatchOwnerTelegram,
  type FaultNotificationEventType,
} from "@/lib/fault-notifications";
import { recordFaultNotificationServer } from "@/lib/fault-notifications-server";
import { pilotFaultToNotificationInput } from "@/lib/fault-notification-client";
import {
  mapPilotFaultRow,
  PILOT_FAULTS_TABLE,
  PILOT_FEEDBACK_TABLE,
  type PilotCloudFault,
} from "@/lib/pilot-cloud";
import type { StatisticsFaultRow } from "@/lib/statistics";
import { deliverTelegramMessage } from "@/lib/telegram";
import { getSupabaseServiceClient } from "@/lib/supabase-server";
import type { Elevator, Fault, FaultStatus, FaultType } from "@/lib/types";

function isElevatorAuthorizedForClientAccess(
  elevatorId: string,
  authorizedElevatorIds: readonly string[],
  accessLevel: "building" | "elevator",
  lockedElevatorId: string | null
): boolean {
  const trimmed = elevatorId.trim();
  if (!trimmed) return false;
  if (!authorizedElevatorIds.includes(trimmed)) return false;
  if (accessLevel === "elevator" && lockedElevatorId) {
    return trimmed === lockedElevatorId;
  }
  return true;
}

function mapClientUserRowServer(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    name: String(row.name),
    phone: row.phone ? String(row.phone) : null,
    email: row.email ? String(row.email) : null,
    client_type: row.client_type ? String(row.client_type) : null,
    welcome_message: row.welcome_message ? String(row.welcome_message) : null,
    access_token: String(row.access_token),
    is_active: Boolean(row.is_active),
    expires_at: row.expires_at ? String(row.expires_at) : null,
    created_at: String(row.created_at),
  };
}

function mapClientAccessRowServer(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    client_user_id: String(row.client_user_id),
    building_id: String(row.building_id),
    elevator_id: row.elevator_id ? String(row.elevator_id) : null,
    access_level: row.access_level === "elevator" ? ("elevator" as const) : ("building" as const),
    created_at: String(row.created_at),
  };
}

function mapPermissionRowServer(row: Record<string, unknown>): ClientPermissionRecord {
  return {
    id: String(row.id),
    client_user_id: String(row.client_user_id),
    can_view_building_dashboard: Boolean(row.can_view_building_dashboard),
    can_report_faults: Boolean(row.can_report_faults),
    can_view_open_faults: Boolean(row.can_view_open_faults),
    can_view_fault_history: Boolean(row.can_view_fault_history),
    can_view_availability: Boolean(row.can_view_availability),
    can_view_documents: Boolean(row.can_view_documents),
    can_view_statistics: Boolean(row.can_view_statistics),
    can_upload_images: Boolean(row.can_upload_images),
    can_receive_notifications: Boolean(row.can_receive_notifications),
    can_submit_feedback: Boolean(row.can_submit_feedback),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

export async function getClientAccessSessionByTokenServer(
  token: string
): Promise<ClientAccessSession | null> {
  const client = getSupabaseServiceClient();
  const trimmed = token.trim();
  if (!client || !trimmed) return null;

  const { data: userRow, error: userError } = await client
    .from(CLIENT_USERS_TABLE)
    .select("*")
    .eq("access_token", trimmed)
    .maybeSingle();

  if (userError || !userRow) return null;

  const user = mapClientUserRowServer(userRow as Record<string, unknown>);
  const { data: accessRows, error: accessError } = await client
    .from(CLIENT_ACCESS_TABLE)
    .select("*")
    .eq("client_user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1);

  if (accessError || !accessRows?.[0]) return null;

  return {
    user: user as ClientAccessSession["user"],
    access: mapClientAccessRowServer(accessRows[0] as Record<string, unknown>),
  };
}

export async function getClientPermissionsServer(
  clientUserId: string
): Promise<ClientPermissionFlags> {
  const client = getSupabaseServiceClient();
  if (!client || !clientUserId.trim()) return { ...DEFAULT_CLIENT_PERMISSIONS };

  const { data, error } = await client
    .from(CLIENT_PERMISSIONS_TABLE)
    .select("*")
    .eq("client_user_id", clientUserId)
    .maybeSingle();

  if (error || !data) return { ...DEFAULT_CLIENT_PERMISSIONS };
  return extractClientPermissionFlags(mapPermissionRowServer(data as Record<string, unknown>));
}

function mapPilotFaultToClientFault(fault: PilotCloudFault): Fault {
  return {
    id: fault.id,
    elevatorId: fault.elevator_id,
    elevatorName: fault.elevator_name,
    type: fault.fault_type as FaultType,
    description: fault.description,
    status: fault.status as FaultStatus,
    priority: "רגילה",
    reportedAt: fault.created_at,
    resolvedAt: fault.closed_at ?? undefined,
    ticketNumber: fault.ticket_number ?? undefined,
    isDisabled: fault.is_disabled,
  };
}

function mergePortalFaultsServer(
  buildingId: string,
  buildingName: string,
  cloudFaults: PilotCloudFault[]
): PilotCloudFault[] {
  const merged = [...cloudFaults];
  const seen = new Set(merged.map((fault) => fault.id));
  const demoFaults = getDemoFaultsForPortalBuilding(buildingId);

  for (const fault of demoFaults) {
    if (seen.has(fault.id)) continue;
    merged.push({
      id: fault.id,
      building_id: buildingId,
      building_name: buildingName,
      elevator_id: fault.elevatorId,
      elevator_name: fault.elevatorName,
      fault_type: fault.type,
      description: fault.description,
      is_disabled: fault.isDisabled ?? false,
      status: fault.status,
      ticket_number: fault.ticketNumber ?? null,
      image_data: null,
      image_url: null,
      created_at: fault.reportedAt,
      closed_at: fault.resolvedAt ?? null,
      source_device_id: null,
      fault_source: null,
      treatment_note: null,
      closure_note: null,
      treatment_started_at: null,
    });
  }

  return merged;
}

async function fetchBuildingFaultsServer(
  buildingId: string
): Promise<PilotCloudFault[]> {
  const client = getSupabaseServiceClient();
  if (!client) return [];

  const normalized = normalizeBuildingId(buildingId);
  const { data, error } = await client
    .from(PILOT_FAULTS_TABLE)
    .select("*")
    .eq("building_id", normalized)
    .order("created_at", { ascending: false });

  if (error) {
    console.warn("[client-portal-server] fetch faults failed:", error.message);
    return [];
  }

  return (data ?? []).map((row) =>
    mapPilotFaultRow(row as Record<string, unknown>)
  );
}

async function fetchClientDocumentsServer(
  buildingId: string
): Promise<ClientPortalDocumentDto[]> {
  const client = getSupabaseServiceClient();
  if (!client) return [];

  const normalized = normalizeBuildingId(buildingId);
  const { data, error } = await client
    .from("documents")
    .select("id, title, document_type, file_url, created_at, building_id, visibility")
    .eq("building_id", normalized)
    .eq("visibility", "client")
    .order("created_at", { ascending: false });

  if (error) {
    console.warn("[client-portal-server] fetch documents failed:", error.message);
    return [];
  }

  return (data ?? []).map((row) => ({
    id: String((row as Record<string, unknown>).id),
    title: String((row as Record<string, unknown>).title ?? ""),
    document_type: String((row as Record<string, unknown>).document_type ?? ""),
    file_url: (row as Record<string, unknown>).file_url
      ? String((row as Record<string, unknown>).file_url)
      : null,
    created_at: String((row as Record<string, unknown>).created_at ?? ""),
  }));
}

async function fetchStatisticsRowsServer(
  buildingId: string
): Promise<StatisticsFaultRow[]> {
  const client = getSupabaseServiceClient();
  if (!client) return [];

  const normalized = normalizeBuildingId(buildingId);
  const { data, error } = await client
    .from(PILOT_FAULTS_TABLE)
    .select("created_at, fault_type, elevator_name")
    .eq("building_id", normalized)
    .order("created_at", { ascending: true });

  if (error) {
    console.warn("[client-portal-server] statistics fetch failed:", error.message);
    return [];
  }

  return (data ?? []) as StatisticsFaultRow[];
}

async function dispatchFaultCreatedNotificationServer(
  fault: PilotCloudFault
): Promise<void> {
  const input = pilotFaultToNotificationInput(fault, "FAULT_CREATED");
  if (!shouldDispatchOwnerTelegram(input.eventType)) return;

  const message = buildFaultNotificationTelegramMessage(input);
  const telegram = await deliverTelegramMessage(message);

  await recordFaultNotificationServer({
    faultId: input.faultId,
    buildingId: input.buildingId,
    eventType: input.eventType as FaultNotificationEventType,
    status: telegram.ok ? "sent" : "failed",
    error: telegram.ok ? null : telegram.error,
    sentAt: telegram.ok ? new Date().toISOString() : null,
  });
}

export async function buildClientPortalBootstrap(
  auth: ClientPortalAuthContext
): Promise<ClientPortalBootstrapDto | null> {
  const { session, permissions } = auth;
  const accessBuildingId = auth.buildingId;
  const resolved = await resolveClientPortalBuilding(accessBuildingId);
  if (!resolved) return null;

  const normalizedBuildingId = normalizeBuildingId(accessBuildingId);
  const scopedElevators = scopeElevatorsForClientAccess(
    resolved.ctx.elevators,
    session.access
  );

  const cloudFaults = await fetchBuildingFaultsServer(normalizedBuildingId);
  const mergedFaults = mergePortalFaultsServer(
    normalizedBuildingId,
    resolved.buildingName,
    cloudFaults
  );
  const liveStartedAt = resolved.liveStartedAt;
  const liveFiltered = liveStartedAt
    ? mergedFaults.filter((fault) =>
        isAfterLiveStart(fault.created_at, liveStartedAt)
      )
    : mergedFaults;
  const scopedFaults = scopeFaultsForClientAccess(
    liveFiltered,
    session.access
  ).map(mapPilotFaultToClientFault);

  const documents = permissions.can_view_documents
    ? await fetchClientDocumentsServer(normalizedBuildingId)
    : [];

  const scopeLabel =
    session.access.access_level === "elevator" && session.access.elevator_id
      ? scopedElevators[0]?.name ?? session.access.elevator_id
      : "כל הבניין";

  const welcomeMessage = resolveClientWelcomeMessage(
    session.user.welcome_message,
    session.user.client_type
  );

  return {
    user: {
      id: session.user.id,
      name: session.user.name,
      welcomeMessage,
      clientType: session.user.client_type,
    },
    access: {
      accessLevel: session.access.access_level,
      elevatorId: session.access.elevator_id,
    },
    permissions,
    building: {
      id: resolved.loadedBuildingId,
      name: resolved.buildingName,
      buildingCode: resolved.ctx.building.buildingCode,
      liveStartedAt: resolved.liveStartedAt,
    },
    elevators: scopedElevators,
    faults: scopedFaults,
    documents,
    scopeLabel,
    dataLastUpdated: computePortalDataLastUpdated([
      ...scopedFaults.flatMap((fault) => [fault.reportedAt, fault.resolvedAt]),
      ...documents.map((doc) => doc.created_at),
    ]),
  };
}

export async function submitClientPortalFaultServer(
  auth: ClientPortalAuthContext,
  input: ClientPortalFaultSubmitInput,
  elevators: Elevator[]
): Promise<
  | { ok: true; fault: ClientPortalFaultSubmitResult }
  | { ok: false; error: string }
> {
  const client = getSupabaseServiceClient();
  if (!client) return { ok: false, error: "service_unconfigured" };

  const elevatorIds = elevators.map((elevator) => elevator.id);
  if (
    !isElevatorAuthorizedForClientAccess(
      input.elevatorId,
      elevatorIds,
      auth.session.access.access_level,
      auth.session.access.elevator_id
    )
  ) {
    return { ok: false, error: "forbidden_elevator" };
  }

  const selectedElevator = elevators.find(
    (elevator) => elevator.id === input.elevatorId
  );
  if (!selectedElevator) {
    return { ok: false, error: "invalid_elevator" };
  }

  const resolved = await resolveClientPortalBuilding(auth.buildingId);
  if (!resolved) return { ok: false, error: "building_not_found" };

  const row = {
    building_id: normalizeBuildingId(auth.buildingId),
    building_name: resolved.buildingName,
    elevator_id: input.elevatorId,
    elevator_name: selectedElevator.name,
    fault_type: input.faultType,
    description: input.description.trim(),
    is_disabled: Boolean(input.isDisabled),
    status: "פתוחה",
    ticket_number: input.ticketNumber ?? null,
    image_data: input.imageData ?? null,
    image_url: null,
    source_device_id: null,
    fault_source: CLIENT_PORTAL_FAULT_SOURCE,
  };

  const { data, error } = await client
    .from(PILOT_FAULTS_TABLE)
    .insert(row)
    .select("*")
    .single();

  if (error || !data) {
    console.warn("[client-portal-server] fault insert failed:", error?.message);
    return { ok: false, error: "insert_failed" };
  }

  const mapped = mapPilotFaultRow(data as Record<string, unknown>);
  void dispatchFaultCreatedNotificationServer(mapped);

  return {
    ok: true,
    fault: {
      id: mapped.id,
      ticketNumber: mapped.ticket_number,
      status: mapped.status as FaultStatus,
      type: mapped.fault_type as FaultType,
      description: mapped.description,
      elevatorId: mapped.elevator_id,
      elevatorName: mapped.elevator_name,
      reportedAt: mapped.created_at,
    },
  };
}

export async function submitClientPortalFeedbackServer(
  auth: ClientPortalAuthContext,
  input: ClientPortalFeedbackSubmitInput
): Promise<{ ok: true } | { ok: false; error: string }> {
  const client = getSupabaseServiceClient();
  if (!client) return { ok: false, error: "service_unconfigured" };

  const resolved = await resolveClientPortalBuilding(auth.buildingId);
  if (!resolved) return { ok: false, error: "building_not_found" };

  const row = {
    building_id: normalizeBuildingId(auth.buildingId),
    building_name: resolved.buildingName,
    sender_name: input.senderName.trim(),
    sender_role: input.senderRole,
    rating: input.rating,
    would_use_regularly: input.wouldUseRegularly,
    unclear_or_missing: input.unclearOrMissing.trim(),
    expected_feature: input.expectedFeature.trim(),
    would_recommend: input.wouldRecommend,
    source_device_id: null,
  };

  const { error } = await client.from(PILOT_FEEDBACK_TABLE).insert(row);
  if (error) {
    console.warn("[client-portal-server] feedback insert failed:", error.message);
    return { ok: false, error: "insert_failed" };
  }

  return { ok: true };
}

export async function logClientPortalActivityServer(
  auth: ClientPortalAuthContext,
  input: ClientPortalActivityInput
): Promise<boolean> {
  const client = getSupabaseServiceClient();
  if (!client || !input.actionType.trim()) return false;

  const { error } = await client.from(CLIENT_ACTIVITY_LOG_TABLE).insert({
    client_user_id: auth.session.user.id,
    action_type: input.actionType.trim(),
    action_details: input.actionDetails ?? null,
  });

  if (error) {
    console.warn("[client-portal-server] activity log failed:", error.message);
    return false;
  }

  return true;
}

export async function fetchClientPortalStatisticsServer(
  auth: ClientPortalAuthContext
): Promise<ClientPortalStatisticsDto> {
  const rows = await fetchStatisticsRowsServer(auth.buildingId);
  const { access_level, elevator_id } = auth.session.access;

  if (access_level === "elevator" && elevator_id) {
    const resolved = await resolveClientPortalBuilding(auth.buildingId);
    const scopedElevators = scopeElevatorsForClientAccess(
      resolved?.ctx.elevators ?? [],
      auth.session.access
    );
    const lockedName = scopedElevators[0]?.name;
    if (lockedName) {
      return {
        rows: rows.filter(
          (row) => (row.elevator_name?.trim() || "לא צוין") === lockedName
        ),
      };
    }
  }

  return { rows };
}
