"use client";

import { useEffect, useMemo, useState } from "react";
import ForteContactForm from "@/components/forte/ForteContactForm";
import {
  ForteV2Dialog,
  ForteV2DialogOverlay,
  ForteV2PrimaryButton,
  ForteV2SecondaryButton,
  ForteV2StatusBanner,
} from "@/components/master-v2/project-v2/MasterProjectV2Workspace";
import { createContact } from "@/lib/contacts-cloud";
import {
  emptyContactInput,
  findContactByExactMatch,
  validateContactInput,
  type Contact,
  type ContactInput,
} from "@/lib/contacts";

interface VcfImportContactDialogProps {
  open: boolean;
  initialForm: ContactInput | null;
  parseError: string | null;
  contacts: Contact[];
  onClose: () => void;
  onSaved: () => void | Promise<void>;
  guardSensitiveAction: () => boolean;
}

export default function VcfImportContactDialog({
  open,
  initialForm,
  parseError,
  contacts,
  onClose,
  onSaved,
  guardSensitiveAction,
}: VcfImportContactDialogProps) {
  const [form, setForm] = useState<ContactInput>(emptyContactInput());
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [forceCreate, setForceCreate] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(initialForm ?? emptyContactInput());
    setFormError(null);
    setSaving(false);
    setForceCreate(false);
  }, [open, initialForm, parseError]);

  const duplicateContact = useMemo(() => {
    if (!open || parseError || !initialForm || forceCreate) return null;
    return findContactByExactMatch(form, contacts);
  }, [open, parseError, initialForm, forceCreate, form, contacts]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (saving || parseError || !initialForm) return;
    if (!guardSensitiveAction()) return;

    const validationError = validateContactInput(form);
    if (validationError) {
      setFormError(validationError);
      return;
    }

    if (duplicateContact && !forceCreate) {
      return;
    }

    setSaving(true);
    setFormError(null);

    const result = await createContact(form);
    setSaving(false);

    if (!result.contact) {
      setFormError(result.error ?? "שמירה נכשלה.");
      return;
    }

    await onSaved();
    onClose();
  }

  if (!open) return null;

  return (
    <ForteV2DialogOverlay onClose={onClose}>
      <ForteV2Dialog title="ייבוא איש קשר" onClose={onClose} size="lg">
        {parseError ? (
          <div className="space-y-4">
            <ForteV2StatusBanner tone="error">{parseError}</ForteV2StatusBanner>
            <div className="flex gap-2">
              <ForteV2SecondaryButton onClick={onClose} size="sm">
                סגור
              </ForteV2SecondaryButton>
            </div>
          </div>
        ) : (
          <form onSubmit={(e) => void handleSave(e)} className="space-y-4">
            <p className="text-sm text-forte-text-secondary">
              בדקו ועדכנו את הנתונים לפני השמירה בספר אנשי הקשר.
            </p>

            {duplicateContact && !forceCreate && (
              <ForteV2StatusBanner tone="warning">
                <p className="font-medium">ייתכן שאיש הקשר כבר קיים בספר אנשי הקשר</p>
                <p className="mt-1 text-sm">
                  {duplicateContact.fullName}
                  {duplicateContact.phone ? ` · ${duplicateContact.phone}` : ""}
                  {duplicateContact.email ? ` · ${duplicateContact.email}` : ""}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <ForteV2SecondaryButton
                    type="button"
                    size="sm"
                    onClick={onClose}
                  >
                    ביטול ייבוא
                  </ForteV2SecondaryButton>
                  <ForteV2PrimaryButton
                    type="button"
                    size="sm"
                    onClick={() => setForceCreate(true)}
                  >
                    המשך ויצירת איש קשר חדש
                  </ForteV2PrimaryButton>
                </div>
              </ForteV2StatusBanner>
            )}

            {formError && <ForteV2StatusBanner tone="error">{formError}</ForteV2StatusBanner>}

            <ForteContactForm
              form={form}
              onChange={(patch) => setForm((current) => ({ ...current, ...patch }))}
            />

            <div className="flex gap-2 pt-1">
              <ForteV2PrimaryButton
                type="submit"
                disabled={saving || Boolean(duplicateContact && !forceCreate)}
                size="sm"
              >
                {saving ? "שומר..." : "שמור איש קשר"}
              </ForteV2PrimaryButton>
              <ForteV2SecondaryButton type="button" onClick={onClose} size="sm">
                ביטול
              </ForteV2SecondaryButton>
            </div>
          </form>
        )}
      </ForteV2Dialog>
    </ForteV2DialogOverlay>
  );
}
