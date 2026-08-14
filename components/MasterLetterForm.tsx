"use client";

import MasterLetterPartyEditor, {
  snapshotsPreviewLines,
} from "@/components/MasterLetterPartyEditor";
import {
  buildMasterLetterPreview,
  type MasterLetterBuildingContext,
  type MasterLetterDraftInput,
  type MasterLetterDossierSection,
  type MasterLetterFieldValue,
  type MasterLetterTemplateId,
} from "@/lib/master-letters";
import {
  MASTER_LETTER_DOSSIER_SECTION_LABELS,
  MASTER_LETTER_DOSSIER_SECTIONS,
} from "@/lib/master-letter-metadata";
import {
  collectBlockedCentralContactIds,
  resolvePartySnapshots,
  type MasterLetterPartyEntry,
  type MasterLetterPartyResolveContext,
} from "@/lib/master-letter-parties";
import {
  getMasterLetterTemplate,
  MASTER_LETTER_TEMPLATES,
  type MasterLetterTemplateField,
} from "@/lib/master-letter-templates";
import type { MasterBuildingSearchHit } from "@/lib/master-building-search";
import type { Contact, ProjectContactWithDetails } from "@/lib/contacts";
import MasterExistingBuildingSearch, {
  MasterBuildingProfileCard,
} from "@/components/MasterExistingBuildingSearch";
import type { MasterBuildingEntry } from "@/lib/master-buildings-list";

interface MasterLetterFormProps {
  entries: MasterBuildingEntry[];
  resolveElevatorCount: (buildingId: string) => number;
  fixedBuildingId?: string;
  projectContacts?: ProjectContactWithDetails[];
  centralContacts?: Contact[];
  onCentralContactsChange?: (contacts: Contact[]) => void;
  templateId: MasterLetterTemplateId;
  onTemplateIdChange: (templateId: MasterLetterTemplateId) => void;
  templateFields: Record<string, MasterLetterFieldValue>;
  onTemplateFieldChange: (fieldId: string, value: MasterLetterFieldValue) => void;
  selectedBuildingHit: MasterBuildingSearchHit | null;
  onSelectBuildingHit: (hit: MasterBuildingSearchHit | null) => void;
  elevatorOptions: Array<{ id: string; name: string }>;
  elevatorId: string;
  onElevatorIdChange: (elevatorId: string) => void;
  title: string;
  onTitleChange: (title: string) => void;
  subject: string;
  onSubjectChange: (subject: string) => void;
  customNote: string;
  onCustomNoteChange: (note: string) => void;
  recipientEntries: MasterLetterPartyEntry[];
  onRecipientEntriesChange: (entries: MasterLetterPartyEntry[]) => void;
  ccEntries: MasterLetterPartyEntry[];
  onCcEntriesChange: (entries: MasterLetterPartyEntry[]) => void;
  dossierSection: MasterLetterDossierSection;
  onDossierSectionChange: (section: MasterLetterDossierSection) => void;
  showPreview: boolean;
  onTogglePreview: () => void;
}

function toBuildingContext(
  hit: MasterBuildingSearchHit
): MasterLetterBuildingContext {
  return {
    buildingId: hit.profile.buildingId,
    buildingName: hit.profile.name,
    address: hit.profile.address,
    city: hit.profile.city,
    managementCompany: hit.profile.managementCompany,
  };
}

function isFieldVisible(
  field: MasterLetterTemplateField,
  templateFields: Record<string, MasterLetterFieldValue>
): boolean {
  if (!field.showIf) return true;
  return String(templateFields[field.showIf.fieldId] ?? "") === field.showIf.value;
}

function renderFieldInput(
  field: MasterLetterTemplateField,
  value: MasterLetterFieldValue | undefined,
  onChange: (fieldId: string, nextValue: MasterLetterFieldValue) => void
) {
  const fieldId = `letter-field-${field.id}`;

  if (field.type === "textarea") {
    return (
      <textarea
        id={fieldId}
        rows={4}
        value={String(value ?? "")}
        onChange={(event) => onChange(field.id, event.target.value)}
        className="form-input resize-none"
        placeholder={field.placeholder}
        required={field.required}
      />
    );
  }

  if (field.type === "select") {
    return (
      <select
        id={fieldId}
        value={String(value ?? "")}
        onChange={(event) => onChange(field.id, event.target.value)}
        className="form-input"
        required={field.required}
      >
        <option value="">בחר...</option>
        {(field.options ?? []).map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    );
  }

  if (field.type === "boolean") {
    return (
      <select
        id={fieldId}
        value={value === true ? "true" : value === false ? "false" : ""}
        onChange={(event) => onChange(field.id, event.target.value === "true")}
        className="form-input"
        required={field.required}
      >
        <option value="">בחר...</option>
        <option value="true">כן</option>
        <option value="false">לא</option>
      </select>
    );
  }

  return (
    <input
      id={fieldId}
      type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
      value={String(value ?? "")}
      onChange={(event) =>
        onChange(
          field.id,
          field.type === "number" ? Number(event.target.value) : event.target.value
        )
      }
      className="form-input"
      placeholder={field.placeholder}
      required={field.required}
      min={field.type === "number" ? 0 : undefined}
    />
  );
}

export function buildLetterDraftFromForm(params: {
  templateId: MasterLetterTemplateId;
  templateFields: Record<string, MasterLetterFieldValue>;
  selectedBuildingHit: MasterBuildingSearchHit | null;
  elevatorId: string;
  elevatorOptions: Array<{ id: string; name: string }>;
  subject: string;
  customNote: string;
  recipientEntries: MasterLetterPartyEntry[];
  ccEntries: MasterLetterPartyEntry[];
  projectContacts: ProjectContactWithDetails[];
  centralContacts: Contact[];
  dossierSection: MasterLetterDossierSection;
}): MasterLetterDraftInput | null {
  if (!params.selectedBuildingHit) return null;

  const elevatorName =
    params.elevatorOptions.find((elevator) => elevator.id === params.elevatorId)
      ?.name ?? null;

  const partyContext: MasterLetterPartyResolveContext = {
    projectContacts: params.projectContacts,
    centralContacts: params.centralContacts,
  };

  const recipients = resolvePartySnapshots(params.recipientEntries, partyContext);
  const cc = resolvePartySnapshots(params.ccEntries, partyContext);

  return {
    templateId: params.templateId,
    templateFields: params.templateFields,
    subject: params.subject,
    building: toBuildingContext(params.selectedBuildingHit),
    elevatorId: params.elevatorId.trim() || null,
    elevatorName,
    customNote: params.customNote,
    recipients,
    cc,
    section: params.dossierSection,
  };
}

export default function MasterLetterForm({
  entries,
  resolveElevatorCount,
  fixedBuildingId,
  projectContacts = [],
  centralContacts = [],
  onCentralContactsChange,
  templateId,
  onTemplateIdChange,
  templateFields,
  onTemplateFieldChange,
  selectedBuildingHit,
  onSelectBuildingHit,
  elevatorOptions,
  elevatorId,
  onElevatorIdChange,
  title,
  onTitleChange,
  subject,
  onSubjectChange,
  customNote,
  onCustomNoteChange,
  recipientEntries,
  onRecipientEntriesChange,
  ccEntries,
  onCcEntriesChange,
  dossierSection,
  onDossierSectionChange,
  showPreview,
  onTogglePreview,
}: MasterLetterFormProps) {
  const template = getMasterLetterTemplate(templateId);
  const draft = buildLetterDraftFromForm({
    templateId,
    templateFields,
    selectedBuildingHit,
    elevatorId,
    elevatorOptions,
    subject,
    customNote,
    recipientEntries,
    ccEntries,
    projectContacts,
    centralContacts,
    dossierSection,
  });
  const preview = draft ? buildMasterLetterPreview(draft) : null;
  const partyPreview =
    draft?.recipients && draft.recipients.length > 0
      ? snapshotsPreviewLines(draft.recipients, draft.cc ?? [])
      : [];
  const visibleFields =
    template?.fields.filter((field) => isFieldVisible(field, templateFields)) ??
    [];
  const recipientBlockedForCc = collectBlockedCentralContactIds(
    recipientEntries,
    projectContacts
  );

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-4">
      <div>
        <label className="form-label" htmlFor="letter-template">
          סוג / תבנית מכתב
        </label>
        <select
          id="letter-template"
          value={templateId}
          onChange={(event) =>
            onTemplateIdChange(event.target.value as MasterLetterTemplateId)
          }
          className="form-input"
        >
          {MASTER_LETTER_TEMPLATES.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
        {template?.description && (
          <p className="text-xs text-gray-text mt-2">{template.description}</p>
        )}
      </div>

      <div>
        <label className="form-label" htmlFor="letter-dossier-section">
          תחום בתיק הבניין
        </label>
        <select
          id="letter-dossier-section"
          value={dossierSection}
          onChange={(event) =>
            onDossierSectionChange(event.target.value as MasterLetterDossierSection)
          }
          className="form-input"
        >
          {MASTER_LETTER_DOSSIER_SECTIONS.map((section) => (
            <option key={section} value={section}>
              {MASTER_LETTER_DOSSIER_SECTION_LABELS[section]}
            </option>
          ))}
        </select>
      </div>

      <MasterLetterPartyEditor
        sectionTitle="נמענים"
        fieldLabel="נמען ראשי"
        comboboxInputId="letter-recipient-picker"
        entries={recipientEntries}
        onChange={onRecipientEntriesChange}
        projectContacts={projectContacts}
        centralContacts={centralContacts}
        onCentralContactsChange={onCentralContactsChange ?? (() => {})}
        blockedCentralContactIds={new Set()}
      />

      <MasterLetterPartyEditor
        sectionTitle="עותק"
        fieldLabel="עותק"
        comboboxInputId="letter-cc-picker"
        entries={ccEntries}
        onChange={onCcEntriesChange}
        projectContacts={projectContacts}
        centralContacts={centralContacts}
        onCentralContactsChange={onCentralContactsChange ?? (() => {})}
        blockedCentralContactIds={recipientBlockedForCc}
        allowEmpty
      />

      <div>
        <label className="form-label" htmlFor="letter-title">
          כותרת (לתיק הבניין)
        </label>
        <input
          id="letter-title"
          type="text"
          value={title}
          onChange={(event) => onTitleChange(event.target.value)}
          className="form-input"
          placeholder="לדוגמה: מכתב לחברת המעליות — ישורון 34"
        />
      </div>

      <div>
        <label className="form-label" htmlFor="letter-subject">
          נושא המכתב
        </label>
        <input
          id="letter-subject"
          type="text"
          value={subject}
          onChange={(event) => onSubjectChange(event.target.value)}
          className="form-input"
          placeholder={template?.defaultSubject ?? "נושא המכתב"}
        />
      </div>

      {!fixedBuildingId ? (
        <div className="space-y-2">
          <p className="form-label mb-0">בניין</p>
          <MasterExistingBuildingSearch
            entries={entries}
            resolveElevatorCount={resolveElevatorCount}
            selectedHit={selectedBuildingHit}
            onSelectHit={onSelectBuildingHit}
            mode="select"
          />
          {selectedBuildingHit && (
            <MasterBuildingProfileCard profile={selectedBuildingHit.profile} compact />
          )}
        </div>
      ) : (
        selectedBuildingHit && (
          <div className="rounded-xl border border-gray-100 bg-gray-light/40 p-3">
            <p className="text-xs text-gray-text mb-1">פרויקט</p>
            <MasterBuildingProfileCard profile={selectedBuildingHit.profile} compact />
          </div>
        )
      )}

      <div>
        <label className="form-label" htmlFor="letter-elevator">
          מעלית (אופציונלי)
        </label>
        <select
          id="letter-elevator"
          value={elevatorId}
          onChange={(event) => onElevatorIdChange(event.target.value)}
          className="form-input"
          disabled={!selectedBuildingHit || elevatorOptions.length === 0}
        >
          <option value="">ללא מעלית ספציפית</option>
          {elevatorOptions.map((elevator) => (
            <option key={elevator.id} value={elevator.id}>
              {elevator.name}
            </option>
          ))}
        </select>
      </div>

      {visibleFields.length > 0 && (
        <div className="space-y-4 rounded-xl border border-gray-100 bg-gray-light/40 p-4">
          <p className="text-xs font-semibold text-gold">שדות לתבנית</p>
          {visibleFields.map((field) => (
            <div key={field.id}>
              <label className="form-label" htmlFor={`letter-field-${field.id}`}>
                {field.label}
              </label>
              {renderFieldInput(field, templateFields[field.id], onTemplateFieldChange)}
            </div>
          ))}
        </div>
      )}

      <div>
        <label className="form-label" htmlFor="letter-note">
          הערה נוספת (אופציונלי)
        </label>
        <textarea
          id="letter-note"
          rows={4}
          value={customNote}
          onChange={(event) => onCustomNoteChange(event.target.value)}
          className="form-input resize-none"
          placeholder="טקסט חופשי שיתווסף לגוף המכתב"
        />
      </div>

      <button
        type="button"
        onClick={onTogglePreview}
        disabled={!preview}
        className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-navy hover:bg-gray-50 disabled:opacity-50"
      >
        {showPreview ? "הסתר תצוגה מקדימה" : "תצוגה מקדימה"}
      </button>

      {showPreview && preview && (
        <div className="rounded-xl border border-gold/30 bg-gold/5 p-4 space-y-3">
          <p className="text-xs font-semibold text-gold">תצוגה מקדימה</p>
          {partyPreview.length > 0 && (
            <pre className="text-sm text-navy whitespace-pre-wrap font-sans leading-relaxed">
              {partyPreview.join("\n")}
            </pre>
          )}
          <p className="text-sm font-semibold text-navy">{preview.subject}</p>
          <pre className="text-sm text-navy whitespace-pre-wrap font-sans leading-relaxed">
            {preview.bodyText}
          </pre>
        </div>
      )}
    </div>
  );
}
