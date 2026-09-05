import { attachContactToProject } from "@/lib/project-contacts-server";
import { BUILDINGS_TABLE } from "@/lib/building-contacts-server";
import { normalizeBuildingId } from "@/lib/buildings-cloud";
import {
  createContact,
  getContactById,
  listContacts,
  updateContact,
} from "@/lib/contacts-server";
import { buildMasterProjectV2Path } from "@/lib/master-project-v2-routes";
import { roundMoney } from "@/lib/project-financial";
import { generateNextProjectBuildingId } from "@/lib/project-number";
import { DEFAULT_PROJECT_TYPE } from "@/lib/project-type-config";
import {
  buildSalesContactInput,
  findSalesContactByPhoneThenEmail,
  mergeSalesContactNotes,
  missingWinProjectFields,
  salesLeadCanSyncContact,
  type OpenedSalesProject,
  type SalesWinMissingField,
} from "@/lib/sales-lead-ops";
import type { SalesLead } from "@/lib/sales-leads";
import { isServiceType } from "@/lib/service-type";
import {
  getSupabaseServiceClient,
  isSupabaseServiceConfigured,
} from "@/lib/supabase-server";

export type { OpenedSalesProject };

export type SalesLeadSideEffects = {
  contactId: string | null;
  convertedBuildingId: string | null;
  openedProject: OpenedSalesProject | null;
  projectConversion: { required: true; missing: SalesWinMissingField[] } | null;
  error: string | null;
};

async function listBuildingIdAllocations(): Promise<{
  buildingIds: string[];
  projectNumbers: string[];
}> {
  const client = getSupabaseServiceClient();
  if (!client) return { buildingIds: [], projectNumbers: [] };

  const { data, error } = await client
    .from(BUILDINGS_TABLE)
    .select("building_id, project_number");
  if (error || !data) {
    console.error("[sales-lead-ops-server] list buildings failed", error?.message);
    return { buildingIds: [], projectNumbers: [] };
  }

  return {
    buildingIds: data.map((row) => String(row.building_id ?? "")).filter(Boolean),
    projectNumbers: data
      .map((row) => String(row.project_number ?? "").trim())
      .filter(Boolean),
  };
}

export async function syncSalesLeadContactServer(
  lead: SalesLead
): Promise<{ contactId: string | null; error: string | null }> {
  if (!salesLeadCanSyncContact(lead)) {
    return { contactId: lead.contactId, error: null };
  }

  const input = buildSalesContactInput(lead);

  if (lead.contactId) {
    const existing = await getContactById(lead.contactId);
    if (existing.contact) {
      const updated = await updateContact(lead.contactId, {
        ...input,
        notes: mergeSalesContactNotes(existing.contact.notes, input.notes),
        roleTitle: existing.contact.roleTitle,
      });
      if (!updated.contact) {
        return { contactId: lead.contactId, error: updated.error };
      }
      return { contactId: updated.contact.id, error: null };
    }
  }

  const listed = await listContacts();
  if (listed.error) {
    return { contactId: lead.contactId, error: listed.error };
  }

  const match = findSalesContactByPhoneThenEmail(input, listed.contacts);
  if (match) {
    const updated = await updateContact(match.id, {
      ...input,
      notes: mergeSalesContactNotes(match.notes, input.notes),
      roleTitle: match.roleTitle,
    });
    if (!updated.contact) {
      return { contactId: match.id, error: updated.error };
    }
    return { contactId: updated.contact.id, error: null };
  }

  const created = await createContact(input);
  if (!created.contact) {
    return { contactId: null, error: created.error };
  }
  return { contactId: created.contact.id, error: null };
}

async function createWonProjectFromLead(
  lead: SalesLead
): Promise<{ buildingId: string | null; error: string | null }> {
  if (!isSupabaseServiceConfigured()) {
    return { buildingId: null, error: "supabase_service_unconfigured" };
  }
  const client = getSupabaseServiceClient();
  if (!client) return { buildingId: null, error: "supabase_service_unconfigured" };

  const allocations = await listBuildingIdAllocations();
  let buildingId: string;
  try {
    buildingId = normalizeBuildingId(
      generateNextProjectBuildingId(allocations.buildingIds, allocations.projectNumbers)
    );
  } catch {
    return { buildingId: null, error: "לא ניתן להקצות מספר פרויקט." };
  }

  const serviceType = isServiceType(lead.serviceType) ? lead.serviceType : null;
  const projectType =
    lead.serviceType === "בדק בית / חוות דעת" ? "home_inspection" : DEFAULT_PROJECT_TYPE;

  const { error } = await client.from(BUILDINGS_TABLE).insert({
    building_id: buildingId,
    project_number: buildingId,
    name: lead.buildingName.trim(),
    city: lead.city.trim() || null,
    address: lead.address.trim() || null,
    management_company: lead.clientName.trim() || null,
    contact_name: lead.contactName.trim() || null,
    contact_phone: lead.phone.trim() || null,
    is_active: true,
    project_stage: "הזמנה",
    project_notes: [
      lead.needDescription.trim(),
      lead.email.trim() ? `דוא״ל: ${lead.email.trim()}` : "",
    ]
      .filter(Boolean)
      .join("\n"),
    project_type: projectType,
    order_amount:
      lead.estimatedValue != null ? roundMoney(lead.estimatedValue) : null,
    service_type: serviceType,
    service_type_other: null,
  });

  if (error) {
    console.error("[sales-lead-ops-server] create building failed", error.message);
    return { buildingId: null, error: "save_failed" };
  }

  return { buildingId, error: null };
}

export async function applySalesLeadSideEffects(
  lead: SalesLead,
  persistLinks: (patch: {
    contactId?: string | null;
    convertedBuildingId?: string | null;
  }) => Promise<string | null>
): Promise<SalesLeadSideEffects> {
  const sync = await syncSalesLeadContactServer(lead);
  if (sync.error) {
    return {
      contactId: lead.contactId,
      convertedBuildingId: lead.convertedBuildingId,
      openedProject: null,
      projectConversion: null,
      error: sync.error,
    };
  }

  let contactId = sync.contactId;
  if (contactId !== lead.contactId) {
    const linkError = await persistLinks({ contactId });
    if (linkError) {
      return {
        contactId: lead.contactId,
        convertedBuildingId: lead.convertedBuildingId,
        openedProject: null,
        projectConversion: null,
        error: linkError,
      };
    }
  }

  const withContact: SalesLead = { ...lead, contactId };

  if (withContact.convertedBuildingId) {
    if (contactId) {
      await attachContactToProject({
        buildingId: withContact.convertedBuildingId,
        contactId,
        isPrimary: true,
      });
    }
    return {
      contactId,
      convertedBuildingId: withContact.convertedBuildingId,
      openedProject: null,
      projectConversion: null,
      error: null,
    };
  }

  if (withContact.status !== "זכייה") {
    return {
      contactId,
      convertedBuildingId: null,
      openedProject: null,
      projectConversion: null,
      error: null,
    };
  }

  const missing = missingWinProjectFields(withContact);
  if (missing.length > 0) {
    return {
      contactId,
      convertedBuildingId: null,
      openedProject: null,
      projectConversion: { required: true, missing },
      error: null,
    };
  }

  const created = await createWonProjectFromLead(withContact);
  if (!created.buildingId) {
    return {
      contactId,
      convertedBuildingId: null,
      openedProject: null,
      projectConversion: null,
      error: created.error ?? "save_failed",
    };
  }

  let linkError = await persistLinks({
    contactId,
    convertedBuildingId: created.buildingId,
  });
  if (linkError) {
    linkError = await persistLinks({
      contactId,
      convertedBuildingId: created.buildingId,
    });
  }
  if (linkError) {
    return {
      contactId,
      convertedBuildingId: created.buildingId,
      openedProject: {
        buildingId: created.buildingId,
        path: buildMasterProjectV2Path(created.buildingId),
      },
      projectConversion: null,
      error: linkError,
    };
  }

  if (contactId) {
    await attachContactToProject({
      buildingId: created.buildingId,
      contactId,
      isPrimary: true,
    });
  }

  return {
    contactId,
    convertedBuildingId: created.buildingId,
    openedProject: {
      buildingId: created.buildingId,
      path: buildMasterProjectV2Path(created.buildingId),
    },
    projectConversion: null,
    error: null,
  };
}
