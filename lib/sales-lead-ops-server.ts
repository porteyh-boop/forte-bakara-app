import { attachContactToProject } from "@/lib/project-contacts-server";
import {
  createContact,
  getContactById,
  listContacts,
  updateContact,
} from "@/lib/contacts-server";
import { buildMasterProjectV2Path } from "@/lib/master-project-v2-routes";
import {
  buildSalesContactInput,
  findSalesContactByPhoneThenEmail,
  mergeSalesContactNotes,
  missingWinProjectFields,
  salesLeadCanSyncContact,
  type OpenedSalesProject,
  type SalesWinMissingField,
} from "@/lib/sales-lead-ops";
import {
  buildSalesWinConvertRpcArgs,
  parseSalesWinConvertRpcResult,
  SALES_WIN_CONVERT_RPC,
} from "@/lib/sales-lead-win-convert";
import type { SalesLead } from "@/lib/sales-leads";
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

async function convertWonProjectFromLead(
  lead: SalesLead
): Promise<{
  buildingId: string | null;
  alreadyConverted: boolean;
  error: string | null;
}> {
  if (!isSupabaseServiceConfigured()) {
    return { buildingId: null, alreadyConverted: false, error: "supabase_service_unconfigured" };
  }
  const client = getSupabaseServiceClient();
  if (!client) {
    return { buildingId: null, alreadyConverted: false, error: "supabase_service_unconfigured" };
  }

  const { data, error } = await client.rpc(
    SALES_WIN_CONVERT_RPC,
    buildSalesWinConvertRpcArgs(lead)
  );
  if (error) {
    console.error("[sales-lead-ops-server] win convert RPC failed", error.message);
    if (error.message.includes("missing_building_name")) {
      return { buildingId: null, alreadyConverted: false, error: null };
    }
    if (error.message.includes("missing_service_type_other")) {
      return { buildingId: null, alreadyConverted: false, error: "יש להגדיר סוג שירות אחר." };
    }
    if (error.message.includes("project_number_sequence_exhausted")) {
      return {
        buildingId: null,
        alreadyConverted: false,
        error: "לא ניתן להקצות מספר פרויקט.",
      };
    }
    return { buildingId: null, alreadyConverted: false, error: "save_failed" };
  }

  const parsed = parseSalesWinConvertRpcResult(data);
  if (!parsed) {
    return { buildingId: null, alreadyConverted: false, error: "save_failed" };
  }
  return {
    buildingId: parsed.building_id,
    alreadyConverted: parsed.already_converted,
    error: null,
  };
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

  const converted = await convertWonProjectFromLead(withContact);
  if (!converted.buildingId) {
    return {
      contactId,
      convertedBuildingId: null,
      openedProject: null,
      projectConversion: converted.error
        ? null
        : { required: true, missing: ["buildingName"] },
      error: converted.error,
    };
  }

  return {
    contactId,
    convertedBuildingId: converted.buildingId,
    openedProject: converted.alreadyConverted
      ? null
      : {
          buildingId: converted.buildingId,
          path: buildMasterProjectV2Path(converted.buildingId),
        },
    projectConversion: null,
    error: null,
  };
}
