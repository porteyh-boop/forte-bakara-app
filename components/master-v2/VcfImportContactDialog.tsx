"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  findContactByExactMatch,
  splitIncomingContactsByQueueDuplicates,
  validateContactInput,
  type Contact,
  type ContactInput,
} from "@/lib/contacts";
import { contactInputDisplayName } from "@/lib/vcard-parser";

interface ImportRow {
  id: string;
  form: ContactInput;
  selected: boolean;
  forceImport: boolean;
  expanded: boolean;
}

interface ImportOutcome {
  name: string;
  ok: boolean;
  error?: string;
}

interface VcfImportContactsDialogProps {
  open: boolean;
  initialBatch: ContactInput[] | null;
  appendBatch: ContactInput[] | null;
  parseError: string | null;
  queueNotice: string | null;
  contacts: Contact[];
  onClose: () => void;
  onSaved: (message: string) => void | Promise<void>;
  onAddMore: () => void;
  onBatchesConsumed: () => void;
  onQueueNoticeClear: () => void;
  guardSensitiveAction: () => boolean;
}

function displayField(value: string): string {
  const trimmed = value.trim();
  return trimmed || "—";
}

function buildImportRows(
  items: ContactInput[],
  contacts: Contact[],
  createId: () => string,
  options?: { expandSingle?: boolean }
): ImportRow[] {
  const expandSingle = options?.expandSingle ?? items.length === 1;
  return items.map((form) => {
    const duplicate = findContactByExactMatch(form, contacts);
    return {
      id: createId(),
      form,
      selected: duplicate ? false : true,
      forceImport: false,
      expanded: expandSingle,
    };
  });
}

export default function VcfImportContactsDialog({
  open,
  initialBatch,
  appendBatch,
  parseError,
  queueNotice,
  contacts,
  onClose,
  onSaved,
  onAddMore,
  onBatchesConsumed,
  onQueueNoticeClear,
  guardSensitiveAction,
}: VcfImportContactsDialogProps) {
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [localNotice, setLocalNotice] = useState<string | null>(null);
  const [outcomes, setOutcomes] = useState<ImportOutcome[] | null>(null);
  const nextRowId = useRef(0);

  function createRowId(): string {
    nextRowId.current += 1;
    return `vcf-import-${nextRowId.current}`;
  }

  useEffect(() => {
    if (!open) {
      setRows([]);
      setImporting(false);
      setFormError(null);
      setLocalNotice(null);
      setOutcomes(null);
      nextRowId.current = 0;
      return;
    }

    if (initialBatch && initialBatch.length > 0) {
      setRows(buildImportRows(initialBatch, contacts, createRowId));
      setImporting(false);
      setFormError(null);
      setLocalNotice(null);
      setOutcomes(null);
      onBatchesConsumed();
    }
  }, [open, initialBatch, contacts, onBatchesConsumed]);

  useEffect(() => {
    if (!open || !appendBatch || appendBatch.length === 0) return;

    setRows((current) => {
      const existingForms = current.map((row) => row.form);
      const { accepted, skipped } = splitIncomingContactsByQueueDuplicates(
        appendBatch,
        existingForms
      );

      if (skipped.length > 0) {
        const names = skipped.map((item) => contactInputDisplayName(item)).join(", ");
        setLocalNotice(
          skipped.length === 1
            ? `${names} כבר ברשימה ולא נוסף שוב.`
            : `${skipped.length} אנשי קשר כבר ברשימה ולא נוספו שוב (${names}).`
        );
      }

      if (accepted.length === 0) {
        return current;
      }

      return [
        ...current,
        ...buildImportRows(accepted, contacts, createRowId, { expandSingle: false }),
      ];
    });

    onBatchesConsumed();
  }, [open, appendBatch, contacts, onBatchesConsumed]);

  useEffect(() => {
    if (queueNotice) {
      setLocalNotice(queueNotice);
      onQueueNoticeClear();
    }
  }, [queueNotice, onQueueNoticeClear]);

  const duplicateByRowId = useMemo(() => {
    const map = new Map<string, Contact | null>();
    for (const row of rows) {
      map.set(row.id, findContactByExactMatch(row.form, contacts));
    }
    return map;
  }, [rows, contacts]);

  const selectedCount = useMemo(
    () =>
      rows.filter((row) => {
        if (!row.selected) return false;
        const duplicate = duplicateByRowId.get(row.id);
        if (duplicate && !row.forceImport) return false;
        return true;
      }).length,
    [rows, duplicateByRowId]
  );

  function updateRow(id: string, patch: Partial<ImportRow>) {
    setRows((current) =>
      current.map((row) => (row.id === id ? { ...row, ...patch } : row))
    );
  }

  function updateRowForm(id: string, patch: Partial<ContactInput>) {
    setRows((current) =>
      current.map((row) =>
        row.id === id ? { ...row, form: { ...row.form, ...patch } } : row
      )
    );
  }

  function removeRow(id: string) {
    setRows((current) => current.filter((row) => row.id !== id));
    setLocalNotice(null);
  }

  function selectAll() {
    setRows((current) => current.map((row) => ({ ...row, selected: true })));
  }

  function deselectAll() {
    setRows((current) =>
      current.map((row) => ({ ...row, selected: false, forceImport: false }))
    );
  }

  async function handleImport(e: React.FormEvent) {
    e.preventDefault();
    if (importing || rows.length === 0) return;
    if (!guardSensitiveAction()) return;
    if (selectedCount === 0) {
      setFormError("יש לבחור לפחות איש קשר אחד לייבוא.");
      return;
    }

    setImporting(true);
    setFormError(null);
    setLocalNotice(null);

    const results: ImportOutcome[] = [];
    const queue = rows.filter((row) => {
      if (!row.selected) return false;
      const duplicate = duplicateByRowId.get(row.id);
      if (duplicate && !row.forceImport) return false;
      return true;
    });

    for (const row of queue) {
      const label = contactInputDisplayName(row.form);
      const validationError = validateContactInput(row.form);
      if (validationError) {
        results.push({ name: label, ok: false, error: validationError });
        continue;
      }

      const result = await createContact(row.form);
      if (!result.contact) {
        results.push({
          name: label,
          ok: false,
          error: result.error ?? "שמירה נכשלה.",
        });
        continue;
      }

      results.push({ name: label, ok: true });
    }

    setImporting(false);
    setOutcomes(results);

    const successCount = results.filter((item) => item.ok).length;
    const failedCount = results.length - successCount;

    if (successCount > 0) {
      await onSaved(
        failedCount > 0
          ? `${successCount} אנשי קשר יובאו לספר.`
          : `${successCount} אנשי קשר יובאו לספר.`
      );
    }
  }

  if (!open) return null;

  const dialogTitle =
    rows.length === 1 ? "ייבוא איש קשר" : "ייבוא אנשי קשר";

  const successOutcomes = outcomes?.filter((item) => item.ok) ?? [];
  const failedOutcomes = outcomes?.filter((item) => !item.ok) ?? [];
  const showFatalError = parseError && rows.length === 0 && !outcomes;

  return (
    <ForteV2DialogOverlay onClose={onClose}>
      <ForteV2Dialog title={dialogTitle} onClose={onClose} size="xl">
        {showFatalError ? (
          <div className="space-y-4">
            <ForteV2StatusBanner tone="error">{parseError}</ForteV2StatusBanner>
            <ForteV2SecondaryButton onClick={onClose} size="sm">
              סגור
            </ForteV2SecondaryButton>
          </div>
        ) : outcomes ? (
          <div className="space-y-4">
            {successOutcomes.length > 0 && (
              <ForteV2StatusBanner tone="success">
                {successOutcomes.length} אנשי קשר יובאו בהצלחה
              </ForteV2StatusBanner>
            )}
            {failedOutcomes.length > 0 && (
              <ForteV2StatusBanner tone="warning">
                <p className="font-medium">
                  {failedOutcomes.length} אנשי קשר לא יובאו
                </p>
                <ul className="mt-2 space-y-1 text-sm">
                  {failedOutcomes.map((item) => (
                    <li key={`${item.name}-${item.error}`}>
                      {item.name}
                      {item.error ? ` — ${item.error}` : ""}
                    </li>
                  ))}
                </ul>
              </ForteV2StatusBanner>
            )}
            <ForteV2SecondaryButton onClick={onClose} size="sm">
              סגור
            </ForteV2SecondaryButton>
          </div>
        ) : (
          <form onSubmit={(e) => void handleImport(e)} className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm font-medium text-forte-text">
                נבחרו {rows.length} אנשי קשר
              </p>
              <p className="text-sm text-forte-text-secondary">
                סמנו את אנשי הקשר שברצונכם להוסיף לספר. ניתן לערוך כל איש קשר לפני
                הייבוא, או להוסיף קבצי VCF נוספים.
              </p>
              <div className="flex flex-wrap gap-2">
                <ForteV2SecondaryButton type="button" size="sm" onClick={selectAll}>
                  בחר הכול
                </ForteV2SecondaryButton>
                <ForteV2SecondaryButton type="button" size="sm" onClick={deselectAll}>
                  בטל בחירת הכול
                </ForteV2SecondaryButton>
              </div>
            </div>

            {localNotice && (
              <ForteV2StatusBanner tone="warning">{localNotice}</ForteV2StatusBanner>
            )}
            {formError && <ForteV2StatusBanner tone="error">{formError}</ForteV2StatusBanner>}

            <div className="max-h-[min(52vh,520px)] overflow-y-auto space-y-3 pe-1">
              {rows.map((row) => {
                const duplicate = duplicateByRowId.get(row.id) ?? null;
                const label = contactInputDisplayName(row.form);

                return (
                  <div
                    key={row.id}
                    className="rounded-xl border border-forte-border/70 bg-white p-3 space-y-3"
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        className="mt-1 rounded border-gray-300"
                        checked={row.selected}
                        onChange={(e) =>
                          updateRow(row.id, { selected: e.target.checked })
                        }
                        aria-label={`בחר ${label}`}
                      />
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="font-medium text-forte-text break-words">
                          {label}
                        </div>
                        <div className="text-xs text-forte-text-secondary space-y-0.5">
                          <div className="break-words">
                            חברה: {displayField(row.form.company)}
                          </div>
                          <div className="break-words">
                            תפקיד: {displayField(row.form.roleTitle)}
                          </div>
                          <div className="break-all" dir="ltr">
                            טלפון: {displayField(row.form.phone)}
                          </div>
                          <div className="break-all" dir="ltr">
                            דוא&quot;ל: {displayField(row.form.email)}
                          </div>
                        </div>
                        {duplicate && (
                          <div className="mt-2 rounded-lg bg-amber-50 border border-amber-200 px-2.5 py-2 text-xs text-amber-950">
                            <div className="font-medium">ייתכן שכבר קיים</div>
                            <div className="mt-1 break-words">
                              {duplicate.fullName}
                              {duplicate.phone ? ` · ${duplicate.phone}` : ""}
                              {duplicate.email ? ` · ${duplicate.email}` : ""}
                            </div>
                            <label className="mt-2 flex items-center gap-2">
                              <input
                                type="checkbox"
                                className="rounded border-gray-300"
                                checked={row.forceImport}
                                onChange={(e) =>
                                  updateRow(row.id, {
                                    forceImport: e.target.checked,
                                    selected: e.target.checked ? true : row.selected,
                                  })
                                }
                              />
                              <span>ייבא בכל זאת</span>
                            </label>
                          </div>
                        )}
                      </div>
                      <div className="flex shrink-0 flex-col gap-2">
                        <ForteV2SecondaryButton
                          type="button"
                          size="sm"
                          onClick={() =>
                            updateRow(row.id, { expanded: !row.expanded })
                          }
                        >
                          {row.expanded ? "סגור" : "ערוך"}
                        </ForteV2SecondaryButton>
                        <ForteV2SecondaryButton
                          type="button"
                          size="sm"
                          onClick={() => removeRow(row.id)}
                        >
                          הסר
                        </ForteV2SecondaryButton>
                      </div>
                    </div>

                    {row.expanded && (
                      <div className="border-t border-forte-border/50 pt-3">
                        <ForteContactForm
                          form={row.form}
                          onChange={(patch) => updateRowForm(row.id, patch)}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="sticky bottom-0 bg-white pt-2 space-y-2 border-t border-forte-border/40">
              <ForteV2SecondaryButton
                type="button"
                size="sm"
                onClick={onAddMore}
                disabled={importing}
              >
                + הוסף אנשי קשר נוספים
              </ForteV2SecondaryButton>
              <div className="flex flex-wrap gap-2">
                <ForteV2PrimaryButton
                  type="submit"
                  disabled={importing || selectedCount === 0}
                  size="sm"
                >
                  {importing
                    ? "מייבא..."
                    : selectedCount === 1
                      ? "ייבוא איש קשר"
                      : `ייבוא ${selectedCount} אנשי קשר`}
                </ForteV2PrimaryButton>
                <ForteV2SecondaryButton type="button" onClick={onClose} size="sm">
                  ביטול
                </ForteV2SecondaryButton>
              </div>
            </div>
          </form>
        )}
      </ForteV2Dialog>
    </ForteV2DialogOverlay>
  );
}
