"use client";

import {
  BUILDING_CONTACT_TYPES,
  emptyBuildingContactInput,
  type BuildingContact,
  type BuildingContactInput,
} from "@/lib/building-contacts";

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

interface ForteBuildingContactFormProps {
  form: BuildingContactInput;
  onChange: (patch: Partial<BuildingContactInput>) => void;
}

export default function ForteBuildingContactForm({
  form,
  onChange,
}: ForteBuildingContactFormProps) {
  function handlePhoneChange(value: string) {
    onChange({
      phone: value,
      whatsapp: form.whatsapp === form.phone || !form.whatsapp ? value : form.whatsapp,
    });
  }

  return (
    <div className="space-y-3">
      <FormField label="שם מלא *">
        <input
          className="form-input"
          value={form.fullName}
          onChange={(e) => onChange({ fullName: e.target.value })}
          required
        />
      </FormField>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <FormField label="תפקיד">
          <input
            className="form-input"
            value={form.roleTitle}
            onChange={(e) => onChange({ roleTitle: e.target.value })}
          />
        </FormField>
        <FormField label="חברה / גוף">
          <input
            className="form-input"
            value={form.company}
            onChange={(e) => onChange({ company: e.target.value })}
          />
        </FormField>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <FormField label="טלפון">
          <input
            className="form-input"
            value={form.phone}
            onChange={(e) => handlePhoneChange(e.target.value)}
            dir="ltr"
          />
        </FormField>
        <FormField label="מספר WhatsApp">
          <input
            className="form-input"
            value={form.whatsapp}
            onChange={(e) => onChange({ whatsapp: e.target.value })}
            dir="ltr"
          />
        </FormField>
      </div>

      <FormField label={'דוא"ל'}>
        <input
          type="email"
          className="form-input"
          value={form.email}
          onChange={(e) => onChange({ email: e.target.value })}
          dir="ltr"
        />
      </FormField>

      <FormField label="סוג איש קשר">
        <select
          className="form-input"
          value={form.contactType}
          onChange={(e) =>
            onChange({
              contactType: e.target.value as BuildingContactInput["contactType"],
            })
          }
        >
          {BUILDING_CONTACT_TYPES.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </FormField>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="flex items-center gap-2 text-sm text-navy">
          <input
            type="checkbox"
            checked={form.isPrimary}
            onChange={(e) => onChange({ isPrimary: e.target.checked })}
            className="rounded border-gray-300"
          />
          איש קשר ראשי
        </label>
        <label className="flex items-center gap-2 text-sm text-navy">
          <input
            type="checkbox"
            checked={form.receivesReports}
            onChange={(e) => onChange({ receivesReports: e.target.checked })}
            className="rounded border-gray-300"
          />
          מקבל דיווחים
        </label>
      </div>

      <FormField label="הערות">
        <textarea
          className="form-input min-h-[88px] resize-y"
          value={form.notes}
          onChange={(e) => onChange({ notes: e.target.value })}
        />
      </FormField>
    </div>
  );
}

export function contactFormFromExisting(contact: BuildingContact): BuildingContactInput {
  return {
    fullName: contact.fullName,
    roleTitle: contact.roleTitle,
    company: contact.company,
    phone: contact.phone,
    whatsapp: contact.whatsapp,
    email: contact.email,
    contactType: contact.contactType,
    isPrimary: contact.isPrimary,
    receivesReports: contact.receivesReports,
    notes: contact.notes,
  };
}

export { emptyBuildingContactInput };
