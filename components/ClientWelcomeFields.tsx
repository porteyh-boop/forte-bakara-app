"use client";

import {
  CLIENT_TYPE_NOT_SET_LABEL,
  getClientTypeFormOptions,
  getDefaultWelcomeMessageForClientType,
  type ClientType,
  type StoredClientType,
} from "@/lib/client-profile";

interface ClientWelcomeFieldsProps {
  clientType: ClientType | StoredClientType | "";
  welcomeMessage: string;
  onClientTypeChange: (clientType: ClientType | StoredClientType | "") => void;
  onWelcomeMessageChange: (message: string) => void;
  onResetWelcomeToDefault: () => void;
  showResetButton?: boolean;
  clientTypeLabel?: string;
  welcomeLabel?: string;
}

export default function ClientWelcomeFields({
  clientType,
  welcomeMessage,
  onClientTypeChange,
  onWelcomeMessageChange,
  onResetWelcomeToDefault,
  showResetButton = true,
  clientTypeLabel = "סוג לקוח / גורם מקבל גישה",
  welcomeLabel = "הודעת פתיחה לפורטל",
}: ClientWelcomeFieldsProps) {
  return (
    <>
      <div>
        <label className="text-xs text-gray-text">{clientTypeLabel}</label>
        <select
          value={clientType}
          onChange={(e) =>
            onClientTypeChange(e.target.value as ClientType | StoredClientType | "")
          }
          className="form-input mt-1"
        >
          {getClientTypeFormOptions(clientType).map((option) => (
            <option key={option.value || CLIENT_TYPE_NOT_SET_LABEL} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      <div className="sm:col-span-2 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <label className="text-xs text-gray-text">{welcomeLabel}</label>
          {showResetButton && clientType && (
            <button
              type="button"
              onClick={onResetWelcomeToDefault}
              className="text-[11px] font-semibold text-navy border border-gray-200 rounded-lg px-2.5 py-1 hover:bg-gray-50"
            >
              אפס להודעת ברירת מחדל
            </button>
          )}
        </div>
        <textarea
          value={welcomeMessage}
          onChange={(e) => onWelcomeMessageChange(e.target.value)}
          rows={5}
          className="form-input resize-y min-h-[7rem]"
          placeholder={getDefaultWelcomeMessageForClientType(clientType || null)}
        />
      </div>
    </>
  );
}
