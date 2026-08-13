"use client";

import { emptyContactInput, type Contact, type ContactInput } from "@/lib/contacts";

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

interface ForteContactFormProps {
  form: ContactInput;
  onChange: (patch: Partial<ContactInput>) => void;
  showProjectFields?: boolean;
  projectRole?: string;
  isPrimary?: boolean;
  onProjectRoleChange?: (value: string) => void;
  onPrimaryChange?: (value: boolean) => void;
}

export default function ForteContactForm({
  form,
  onChange,
  showProjectFields = false,
  projectRole = "",
  isPrimary = false,
  onProjectRoleChange,
  onPrimaryChange,
}: ForteContactFormProps) {
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
        <FormField label="חברה / ארגון">
          <input
            className="form-input"
            value={form.company}
            onChange={(e) => onChange({ company: e.target.value })}
          />
        </FormField>
        <FormField label="תפקיד">
          <input
            className="form-input"
            value={form.roleTitle}
            onChange={(e) => onChange({ roleTitle: e.target.value })}
          />
        </FormField>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <FormField label="טלפון">
          <input
            className="form-input"
            value={form.phone}
            onChange={(e) => onChange({ phone: e.target.value })}
            dir="ltr"
          />
        </FormField>
        <FormField label={'דוא"ל'}>
          <input
            type="email"
            className="form-input"
            value={form.email}
            onChange={(e) => onChange({ email: e.target.value })}
            dir="ltr"
          />
        </FormField>
      </div>

      {showProjectFields && (
        <>
          <FormField label="תפקיד בפרויקט">
            <input
              className="form-input"
              value={projectRole}
              onChange={(e) => onProjectRoleChange?.(e.target.value)}
              placeholder="לדוגמה: נציג חברת המעליות למסירה"
            />
          </FormField>
          <label className="flex items-center gap-2 text-sm text-navy">
            <input
              type="checkbox"
              checked={isPrimary}
              onChange={(e) => onPrimaryChange?.(e.target.checked)}
              className="rounded border-gray-300"
            />
            ★ איש קשר ראשי בפרויקט
          </label>
        </>
      )}

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

export function contactInputFromContact(contact: Contact): ContactInput {
  return {
    fullName: contact.fullName,
    company: contact.company,
    roleTitle: contact.roleTitle,
    phone: contact.phone,
    email: contact.email,
    notes: contact.notes,
  };
}

export { emptyContactInput };
