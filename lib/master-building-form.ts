import {
  DEFAULT_ELEVATOR_COMPANIES,
  isOtherElevatorCompany,
} from "./elevator-companies";
import type { CloudBuildingRow, SaveBuildingInput } from "./buildings-cloud";

export type MasterBuildingFormState = {
  buildingId: string;
  name: string;
  city: string;
  address: string;
  managementCompany: string;
  elevatorCompany: string;
  customElevatorCompany: string;
  contactName: string;
  contactPhone: string;
  floorsCount: string;
};

export function emptyMasterBuildingForm(): MasterBuildingFormState {
  return {
    buildingId: "",
    name: "",
    city: "",
    address: "",
    managementCompany: "",
    elevatorCompany: DEFAULT_ELEVATOR_COMPANIES[0],
    customElevatorCompany: "",
    contactName: "",
    contactPhone: "",
    floorsCount: "",
  };
}

export function resolveElevatorCompany(form: MasterBuildingFormState): string {
  if (isOtherElevatorCompany(form.elevatorCompany)) {
    return form.customElevatorCompany.trim();
  }
  return form.elevatorCompany.trim();
}

export function masterBuildingFormFromRow(
  row: CloudBuildingRow
): MasterBuildingFormState {
  const known = DEFAULT_ELEVATOR_COMPANIES.includes(
    row.elevator_company as (typeof DEFAULT_ELEVATOR_COMPANIES)[number]
  );
  return {
    buildingId: row.building_id,
    name: row.name,
    city: row.city ?? "",
    address: row.address ?? "",
    managementCompany: row.management_company ?? "",
    elevatorCompany: known
      ? (row.elevator_company as string)
      : row.elevator_company
        ? "אחר"
        : DEFAULT_ELEVATOR_COMPANIES[0],
    customElevatorCompany: known ? "" : (row.elevator_company ?? ""),
    contactName: row.contact_name ?? "",
    contactPhone: row.contact_phone ?? "",
    floorsCount: row.floors_count != null ? String(row.floors_count) : "",
  };
}

export function buildSaveBuildingPayload(
  form: MasterBuildingFormState
): SaveBuildingInput {
  const floorsCount = form.floorsCount ? Number(form.floorsCount) : null;
  return {
    buildingId: form.buildingId.trim().toLowerCase(),
    name: form.name,
    city: form.city,
    address: form.address,
    managementCompany: form.managementCompany,
    elevatorCompany: resolveElevatorCompany(form),
    contactName: form.contactName,
    contactPhone: form.contactPhone,
    floorsCount: Number.isFinite(floorsCount) ? floorsCount : null,
  };
}

export const MASTER_BUILDING_EDITABLE_FIELD_LABELS = [
  "שם בניין",
  "עיר",
  "כתובת",
  "חברת ניהול של הבניין",
  "חברת מעליות",
  "איש קשר תפעולי של הבניין",
  "טלפון איש קשר תפעולי",
  "מספר קומות",
] as const;
