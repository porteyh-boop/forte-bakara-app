"use client";

import {
  SERVICE_TYPE_OTHER,
  SERVICE_TYPES,
  type ServiceType,
} from "@/lib/service-type";

export interface ServiceTypeFieldValues {
  serviceType: ServiceType | "";
  serviceTypeOther: string;
}

interface ServiceTypeFieldsProps {
  values: ServiceTypeFieldValues;
  onChange: (patch: Partial<ServiceTypeFieldValues>) => void;
  selectId?: string;
  otherInputId?: string;
  required?: boolean;
}

export default function ServiceTypeFields({
  values,
  onChange,
  selectId = "service-type",
  otherInputId = "service-type-other",
  required = false,
}: ServiceTypeFieldsProps) {
  const showOther = values.serviceType === SERVICE_TYPE_OTHER;

  return (
    <div className="space-y-3">
      <label className="block space-y-1">
        <span className="text-xs text-forte-text-secondary">
          סוג שירות{required ? " *" : ""}
        </span>
        <select
          id={selectId}
          value={values.serviceType}
          onChange={(e) => {
            const next = e.target.value as ServiceType | "";
            onChange({
              serviceType: next,
              serviceTypeOther:
                next === SERVICE_TYPE_OTHER ? values.serviceTypeOther : "",
            });
          }}
          className="form-input text-sm py-2 w-full"
        >
          <option value="">— בחר סוג שירות —</option>
          {SERVICE_TYPES.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </label>
      {showOther && (
        <label className="block space-y-1">
          <span className="text-xs text-forte-text-secondary">
            הגדר סוג שירות אחר *
          </span>
          <input
            id={otherInputId}
            type="text"
            value={values.serviceTypeOther}
            onChange={(e) =>
              onChange({ serviceTypeOther: e.target.value })
            }
            placeholder="לדוגמה: בדיקת נזק למעלית"
            className="form-input text-sm py-2 w-full"
          />
        </label>
      )}
    </div>
  );
}

export function serviceTypeFieldsFromRow(
  serviceType: ServiceType | null,
  serviceTypeOther: string | null
): ServiceTypeFieldValues {
  return {
    serviceType: serviceType ?? "",
    serviceTypeOther: serviceTypeOther ?? "",
  };
}
