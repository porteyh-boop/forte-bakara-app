import {
  findOpenMatchingSalesLead,
  PUBLIC_SALES_LEAD_FORM_HISTORY_TEXT,
  PUBLIC_SALES_LEAD_SOURCE,
  type PublicSalesLeadFormInput,
} from "@/lib/sales-lead-public-form";

export const PUBLIC_SALES_LEAD_SUBMIT_RPC = "submit_public_sales_lead_form";

export type PublicSalesLeadSubmitRpcArgs = {
  p_idempotency_key: string;
  p_payload_hash: string;
  p_client_name: string;
  p_contact_name: string;
  p_phone: string;
  p_email: string;
  p_building_name: string;
  p_address: string;
  p_city: string;
  p_service_type: string;
  p_service_type_other: string;
  p_need_description: string;
  p_next_action: string;
  p_ip_hash: string;
};

export type PublicSalesLeadSubmitRpcResult = {
  ok: true;
  already_processed: boolean;
};

export function buildPublicSalesLeadSubmitRpcArgs(input: {
  key: string;
  payloadHash: string;
  form: PublicSalesLeadFormInput;
  nextAction: string;
  ipHash: string;
}): PublicSalesLeadSubmitRpcArgs {
  return {
    p_idempotency_key: input.key,
    p_payload_hash: input.payloadHash,
    p_client_name: input.form.clientName.trim(),
    p_contact_name: input.form.contactName.trim(),
    p_phone: input.form.phone.trim(),
    p_email: input.form.email.trim(),
    p_building_name: input.form.buildingName.trim(),
    p_address: input.form.address.trim(),
    p_city: input.form.city.trim(),
    p_service_type: input.form.serviceType.trim(),
    p_service_type_other: input.form.serviceTypeOther.trim(),
    p_need_description: input.form.needDescription.trim(),
    p_next_action: input.nextAction.trim(),
    p_ip_hash: input.ipHash,
  };
}

export function parsePublicSalesLeadSubmitRpcResult(
  data: unknown
): PublicSalesLeadSubmitRpcResult | null {
  if (!data || typeof data !== "object") return null;
  const row = data as Record<string, unknown>;
  if (row.ok !== true) return null;
  return { ok: true, already_processed: row.already_processed === true };
}

export type SimulatedPublicFormLead = {
  id: string;
  phone: string;
  email: string;
  status: "חדש" | "נוצר קשר" | "זכייה" | "לא נסגר";
  updatedAt: string;
  contactId: string | null;
};

export type SimulatedPublicFormStore = {
  leads: SimulatedPublicFormLead[];
  contacts: { id: string; phone: string; email: string }[];
  history: { leadId: string; text: string }[];
  submissions: { key: string; payloadHash: string; leadId: string }[];
};

type KeyLock = { tail: Promise<void> };

function nextId(prefix: string, store: SimulatedPublicFormStore): string {
  return `${prefix}-${store.leads.length + store.contacts.length + 1}`;
}

/**
 * In-memory model of submit_public_sales_lead_form:
 * lock the idempotency key, reuse a prior submission, else create/update
 * lead + contact + history + idempotency row in one transaction.
 */
export async function simulateSubmitPublicSalesLeadForm(
  store: SimulatedPublicFormStore,
  locks: Map<string, KeyLock>,
  key: string,
  payloadHash: string,
  form: Pick<PublicSalesLeadFormInput, "phone" | "email">,
  options?: { failAfterLeadInsert?: boolean }
): Promise<PublicSalesLeadSubmitRpcResult> {
  const lock = locks.get(key) ?? { tail: Promise.resolve() };
  locks.set(key, lock);

  const run = lock.tail.then(async () => {
    const existing = store.submissions.find((row) => row.key === key);
    if (existing) {
      if (existing.payloadHash !== payloadHash) {
        throw new Error("idempotency_conflict");
      }
      return { ok: true as const, already_processed: true };
    }

    const snapshot: SimulatedPublicFormStore = {
      leads: store.leads.map((lead) => ({ ...lead })),
      contacts: store.contacts.map((contact) => ({ ...contact })),
      history: store.history.map((entry) => ({ ...entry })),
      submissions: store.submissions.map((row) => ({ ...row })),
    };

    try {
      const matchId = findOpenMatchingSalesLead(store.leads, form);
      let leadId = matchId;
      if (!leadId) {
        leadId = nextId("lead", store);
        store.leads.push({
          id: leadId,
          phone: form.phone,
          email: form.email,
          status: "חדש",
          updatedAt: "2026-09-05T14:00:00.000Z",
          contactId: null,
        });
      }

      if (options?.failAfterLeadInsert) {
        throw new Error("simulated_failure");
      }

      const contactId = nextId("contact", store);
      store.contacts.push({
        id: contactId,
        phone: form.phone,
        email: form.email,
      });
      const lead = store.leads.find((item) => item.id === leadId);
      if (lead) lead.contactId = contactId;

      store.history.push({
        leadId,
        text: matchId
          ? PUBLIC_SALES_LEAD_FORM_HISTORY_TEXT
          : "פנייה נוצרה.",
      });
      if (!matchId) {
        store.history.push({
          leadId,
          text: PUBLIC_SALES_LEAD_FORM_HISTORY_TEXT,
        });
      }

      store.submissions.push({ key, payloadHash, leadId });
      return { ok: true as const, already_processed: false };
    } catch (error) {
      store.leads.length = 0;
      store.leads.push(...snapshot.leads);
      store.contacts.length = 0;
      store.contacts.push(...snapshot.contacts);
      store.history.length = 0;
      store.history.push(...snapshot.history);
      store.submissions.length = 0;
      store.submissions.push(...snapshot.submissions);
      throw error;
    }
  });

  lock.tail = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

export async function simulateParallelPublicSalesLeadSubmits(
  store: SimulatedPublicFormStore,
  key: string,
  payloadHash: string,
  form: Pick<PublicSalesLeadFormInput, "phone" | "email">,
  requestCount: number
): Promise<PublicSalesLeadSubmitRpcResult[]> {
  const locks = new Map<string, KeyLock>();
  return Promise.all(
    Array.from({ length: requestCount }, () =>
      simulateSubmitPublicSalesLeadForm(store, locks, key, payloadHash, form)
    )
  );
}

export function emptySimulatedPublicFormStore(): SimulatedPublicFormStore {
  return { leads: [], contacts: [], history: [], submissions: [] };
}

export { PUBLIC_SALES_LEAD_SOURCE };
