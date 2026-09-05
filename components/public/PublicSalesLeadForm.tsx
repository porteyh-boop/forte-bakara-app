"use client";

import { useMemo, useState } from "react";
import { BRAND_APP, BRAND_EDITOR_TITLE, BRAND_FORTE } from "@/lib/brand";
import {
  emptyPublicSalesLeadFormInput,
  PUBLIC_SALES_LEAD_FORM_API_PATH,
  PUBLIC_SALES_LEAD_FORM_SUBMIT_LABEL,
  PUBLIC_SALES_LEAD_FORM_SUCCESS_TEXT,
  type PublicSalesLeadFormInput,
} from "@/lib/sales-lead-public-form";
import { SALES_LEAD_SERVICE_TYPES } from "@/lib/sales-leads";
import { SERVICE_TYPE_OTHER } from "@/lib/service-type";

function newIdempotencyKey(): string {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi?.randomUUID) return cryptoApi.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const rand = Math.floor(Math.random() * 16);
    const value = char === "x" ? rand : (rand & 0x3) | 0x8;
    return value.toString(16);
  });
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-semibold text-[#0d1b3e]">
        {label}
        {required ? <span className="text-red-600"> *</span> : null}
      </span>
      {children}
    </label>
  );
}

const inputClass =
  "w-full rounded-xl border border-[#d7deea] bg-white px-3.5 py-3 text-base text-[#0d1b3e] outline-none transition focus:border-[#c4a35a] focus:ring-2 focus:ring-[#c4a35a]/25";

export default function PublicSalesLeadForm() {
  const startedAt = useMemo(() => Date.now(), []);
  const [idempotencyKey] = useState(newIdempotencyKey);
  const [draft, setDraft] = useState<PublicSalesLeadFormInput>(
    emptyPublicSalesLeadFormInput
  );
  const [honeypot, setHoneypot] = useState("");
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function patch<K extends keyof PublicSalesLeadFormInput>(
    key: K,
    value: PublicSalesLeadFormInput[K]
  ) {
    setDraft((current) => ({ ...current, [key]: value }));
    if (error) setError(null);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (saving || submitted) return;
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(PUBLIC_SALES_LEAD_FORM_API_PATH, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify({
          ...draft,
          companyWebsite: honeypot,
          startedAt,
          idempotencyKey,
        }),
      });
      const payload = (await response.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
      } | null;
      if (!response.ok || !payload?.ok) {
        if (response.status === 429) {
          setError("נשלחו יותר מדי פניות. נסו שוב בעוד כמה דקות.");
        } else if (payload?.error === "service_unavailable") {
          setError("השליחה אינה זמינה כרגע. נסו שוב בעוד כמה דקות.");
        } else if (payload?.error && payload.error !== "invalid_request" && payload.error !== "save_failed") {
          setError(payload.error);
        } else {
          setError("לא ניתן לשלוח את הפרטים. בדקו את השדות ונסו שוב.");
        }
        return;
      }
      setSubmitted(true);
    } catch {
      setError("לא ניתן לשלוח את הפרטים. בדקו את החיבור ונסו שוב.");
    } finally {
      setSaving(false);
    }
  }

  if (submitted) {
    return (
      <div className="rounded-2xl border border-[#d7deea] bg-white p-6 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            className="h-7 w-7"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
        <p className="text-base font-semibold leading-relaxed text-[#0d1b3e]">
          {PUBLIC_SALES_LEAD_FORM_SUCCESS_TEXT}
        </p>
      </div>
    );
  }

  return (
    <form className="space-y-4" onSubmit={(event) => void handleSubmit(event)}>
      <div
        aria-hidden="true"
        className="absolute -left-[9999px] h-px w-px overflow-hidden"
      >
        <label>
          אתר החברה
          <input
            tabIndex={-1}
            autoComplete="off"
            value={honeypot}
            onChange={(event) => setHoneypot(event.target.value)}
          />
        </label>
      </div>

      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <Field label="שם הלקוח / שם החברה או ועד הבית" required>
        <input
          className={inputClass}
          value={draft.clientName}
          onChange={(event) => patch("clientName", event.target.value)}
          required
          autoComplete="organization"
        />
      </Field>
      <Field label="שם איש הקשר" required>
        <input
          className={inputClass}
          value={draft.contactName}
          onChange={(event) => patch("contactName", event.target.value)}
          required
          autoComplete="name"
        />
      </Field>
      <Field label="טלפון" required>
        <input
          className={inputClass}
          value={draft.phone}
          onChange={(event) => patch("phone", event.target.value)}
          required
          inputMode="tel"
          autoComplete="tel"
        />
      </Field>
      <Field label="מייל">
        <input
          className={inputClass}
          type="email"
          value={draft.email}
          onChange={(event) => patch("email", event.target.value)}
          autoComplete="email"
        />
      </Field>
      <Field label="שם הבניין">
        <input
          className={inputClass}
          value={draft.buildingName}
          onChange={(event) => patch("buildingName", event.target.value)}
        />
      </Field>
      <Field label="כתובת">
        <input
          className={inputClass}
          value={draft.address}
          onChange={(event) => patch("address", event.target.value)}
          autoComplete="street-address"
        />
      </Field>
      <Field label="עיר">
        <input
          className={inputClass}
          value={draft.city}
          onChange={(event) => patch("city", event.target.value)}
          autoComplete="address-level2"
        />
      </Field>
      <Field label="סוג השירות">
        <select
          className={inputClass}
          value={draft.serviceType}
          onChange={(event) => {
            const next = event.target.value;
            setDraft((current) => ({
              ...current,
              serviceType: next,
              serviceTypeOther:
                next === SERVICE_TYPE_OTHER ? current.serviceTypeOther : "",
            }));
            if (error) setError(null);
          }}
        >
          <option value="">לא נבחר</option>
          {SALES_LEAD_SERVICE_TYPES.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </Field>
      {draft.serviceType === SERVICE_TYPE_OTHER ? (
        <Field label="פירוט סוג שירות אחר" required>
          <input
            className={inputClass}
            value={draft.serviceTypeOther}
            onChange={(event) => patch("serviceTypeOther", event.target.value)}
            required
          />
        </Field>
      ) : null}
      <Field label="תיאור הפנייה או הבעיה">
        <textarea
          className={`${inputClass} min-h-[110px]`}
          value={draft.needDescription}
          onChange={(event) => patch("needDescription", event.target.value)}
        />
      </Field>
      <Field label="מועד מועדף ליצירת קשר">
        <input
          className={inputClass}
          value={draft.preferredContactAt}
          onChange={(event) => patch("preferredContactAt", event.target.value)}
          placeholder="לדוגמה: בוקר, אחה״צ, יום ראשון בערב"
        />
      </Field>

      <button
        type="submit"
        disabled={saving || submitted}
        className="w-full rounded-xl bg-[#0d1b3e] px-4 py-3.5 text-base font-semibold text-white shadow-sm transition hover:bg-[#132650] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {saving ? "שולח..." : PUBLIC_SALES_LEAD_FORM_SUBMIT_LABEL}
      </button>
      <p className="text-center text-[11px] text-[#5b6b82]">
        {BRAND_FORTE} · {BRAND_APP} · {BRAND_EDITOR_TITLE}
      </p>
    </form>
  );
}
