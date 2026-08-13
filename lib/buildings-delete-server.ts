import {
  BUILDINGS_TABLE,
  ELEVATORS_TABLE,
  canDeleteBuilding,
  normalizeBuildingId,
} from "./buildings-cloud";
import { BUILDING_CONTACTS_TABLE } from "./building-contacts-server";
import { PROJECT_CONTACTS_TABLE } from "./contacts-server";
import {
  CLIENT_ACCESS_TABLE,
} from "./client-access";
import {
  DOCUMENT_CENTER_BUCKET,
  DOCUMENTS_TABLE,
} from "./document-center";
import { PILOT_FAULTS_TABLE, PILOT_FEEDBACK_TABLE } from "./pilot-cloud";
import { getSupabaseServiceClient } from "./supabase-server";

const INSPECTOR_REPORTS_TABLE = "inspector_reports";

export interface DeleteBuildingProjectResult {
  ok: boolean;
  error?: string;
  deletedBuildingId?: string;
}

export async function deleteBuildingProjectServer(params: {
  buildingId: string;
  confirmBuildingId: string;
}): Promise<DeleteBuildingProjectResult> {
  const client = getSupabaseServiceClient();
  if (!client) {
    return { ok: false, error: "Supabase Service Role לא מוגדר בשרת." };
  }

  const buildingId = normalizeBuildingId(params.buildingId);
  const confirmBuildingId = normalizeBuildingId(params.confirmBuildingId);

  if (!buildingId) {
    return { ok: false, error: "מזהה פרויקט לא תקין." };
  }

  if (confirmBuildingId !== buildingId) {
    return { ok: false, error: "מספר האישור אינו תואם למספר הפרויקט." };
  }

  const { data: building, error: lookupError } = await client
    .from(BUILDINGS_TABLE)
    .select("id, building_id, name")
    .eq("building_id", buildingId)
    .maybeSingle();

  if (lookupError) {
    console.warn("[buildings-delete-server] lookup failed:", lookupError.message);
    return { ok: false, error: "טעינת פרויקט נכשלה." };
  }

  if (!building) {
    return { ok: false, error: "פרויקט לא נמצא." };
  }

  const { data: faults, error: faultsError } = await client
    .from(PILOT_FAULTS_TABLE)
    .select("building_id")
    .eq("building_id", buildingId);

  if (faultsError) {
    console.warn("[buildings-delete-server] faults check failed:", faultsError.message);
    return { ok: false, error: "בדיקת תקלות נכשלה." };
  }

  const guard = canDeleteBuilding(buildingId, faults ?? []);
  if (!guard.allowed) {
    return { ok: false, error: guard.reason ?? "לא ניתן למחוק פרויקט זה." };
  }

  const { data: documents, error: docsError } = await client
    .from(DOCUMENTS_TABLE)
    .select("id, storage_path")
    .eq("building_id", buildingId);

  if (docsError) {
    console.warn("[buildings-delete-server] documents load failed:", docsError.message);
    return { ok: false, error: "טעינת מסמכים לפני מחיקה נכשלה." };
  }

  const storagePaths = (documents ?? [])
    .map((row) => row.storage_path)
    .filter((path): path is string => typeof path === "string" && path.trim().length > 0);

  if (storagePaths.length > 0) {
    const { error: storageError } = await client.storage
      .from(DOCUMENT_CENTER_BUCKET)
      .remove(storagePaths);

    if (storageError) {
      console.warn(
        "[buildings-delete-server] storage remove failed:",
        storageError.message
      );
    }
  }

  if ((documents ?? []).length > 0) {
    const { error: deleteDocsError } = await client
      .from(DOCUMENTS_TABLE)
      .delete()
      .eq("building_id", buildingId);

    if (deleteDocsError) {
      console.warn(
        "[buildings-delete-server] documents delete failed:",
        deleteDocsError.message
      );
      return { ok: false, error: "מחיקת מסמכים נכשלה." };
    }
  }

  const dependentDeletes: Array<{ table: string; error?: string }> = [];

  for (const table of [
    INSPECTOR_REPORTS_TABLE,
    BUILDING_CONTACTS_TABLE,
    PROJECT_CONTACTS_TABLE,
    CLIENT_ACCESS_TABLE,
    PILOT_FEEDBACK_TABLE,
    ELEVATORS_TABLE,
  ] as const) {
    const { error } = await client.from(table).delete().eq("building_id", buildingId);
    if (error) {
      dependentDeletes.push({ table, error: error.message });
    }
  }

  if (dependentDeletes.length > 0) {
    console.warn("[buildings-delete-server] dependent delete failed:", dependentDeletes);
    return { ok: false, error: "מחיקת נתונים משויכים לפרויקט נכשלה." };
  }

  const { error: buildingDeleteError } = await client
    .from(BUILDINGS_TABLE)
    .delete()
    .eq("id", building.id);

  if (buildingDeleteError) {
    console.warn(
      "[buildings-delete-server] building delete failed:",
      buildingDeleteError.message
    );
    return { ok: false, error: "מחיקת הפרויקט נכשלה." };
  }

  return { ok: true, deletedBuildingId: buildingId };
}
