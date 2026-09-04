"use client";

import {
  DEFAULT_ELEVATOR_COMPANIES,
  isOtherElevatorCompany,
} from "@/lib/elevator-companies";
import type { MasterBuildingFormState } from "@/lib/master-building-form";

function FormField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-xs text-gray-text">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

interface MasterBuildingDetailsFormProps {
  form: MasterBuildingFormState;
  onChange: (patch: Partial<MasterBuildingFormState>) => void;
  isEdit: boolean;
  showBuildingId?: boolean;
  onPickContact?: () => void;
  children?: React.ReactNode;
}

export default function MasterBuildingDetailsForm({
  form,
  onChange,
  isEdit,
  showBuildingId = true,
  onPickContact,
  children,
}: MasterBuildingDetailsFormProps) {
  return (
    <div className="space-y-3">
      {showBuildingId && (
        <FormField label="מזהה בניין (building_id)">
          <input
            className="form-input"
            value={form.buildingId}
            onChange={(e) => onChange({ buildingId: e.target.value })}
            disabled={isEdit}
            dir="ltr"
            required={!isEdit}
          />
        </FormField>
      )}
      <FormField label="שם בניין">
        <input
          className="form-input"
          value={form.name}
          onChange={(e) => onChange({ name: e.target.value })}
          required
        />
      </FormField>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        <FormField label="עיר">
          <input
            className="form-input"
            value={form.city}
            onChange={(e) => onChange({ city: e.target.value })}
          />
        </FormField>
        <FormField label="כתובת">
          <input
            className="form-input"
            value={form.address}
            onChange={(e) => onChange({ address: e.target.value })}
          />
        </FormField>
      </div>
      <FormField label="חברת ניהול של הבניין">
        <input
          className="form-input"
          value={form.managementCompany}
          onChange={(e) => onChange({ managementCompany: e.target.value })}
        />
      </FormField>
      <FormField label="חברת מעליות">
        <select
          className="form-input"
          value={form.elevatorCompany}
          onChange={(e) => onChange({ elevatorCompany: e.target.value })}
        >
          {DEFAULT_ELEVATOR_COMPANIES.map((company) => (
            <option key={company} value={company}>
              {company}
            </option>
          ))}
        </select>
      </FormField>
      {isOtherElevatorCompany(form.elevatorCompany) && (
        <FormField label="שם חברת מעליות">
          <input
            className="form-input"
            value={form.customElevatorCompany}
            onChange={(e) => onChange({ customElevatorCompany: e.target.value })}
          />
        </FormField>
      )}
      {onPickContact && isEdit && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onPickContact}
            className="text-xs font-semibold text-forte-primary hover:text-forte-primary-hover hover:underline"
          >
            בחר מאנשי הקשר
          </button>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        <FormField label="איש קשר תפעולי של הבניין">
          <input
            className="form-input"
            value={form.contactName}
            onChange={(e) => onChange({ contactName: e.target.value })}
          />
        </FormField>
        <FormField label="טלפון איש קשר תפעולי">
          <input
            className="form-input"
            value={form.contactPhone}
            onChange={(e) => onChange({ contactPhone: e.target.value })}
            dir="ltr"
          />
        </FormField>
      </div>
      <FormField label="מספר קומות">
        <input
          type="number"
          className="form-input"
          value={form.floorsCount}
          onChange={(e) => onChange({ floorsCount: e.target.value })}
          min={0}
        />
      </FormField>
      {children}
    </div>
  );
}
