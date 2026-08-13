"use client";

import { useEffect, useId, useState } from "react";
import {
  ISRAELI_DATE_INVALID_MESSAGE,
  ISRAELI_DATE_PLACEHOLDER,
  isoToIsraeliDisplay,
  israeliDisplayToIso,
} from "@/lib/israeli-date-input";

interface IsraeliDateInputProps {
  label: string;
  value: string;
  onChange: (isoValue: string) => void;
  required?: boolean;
  hint?: string;
  className?: string;
}

export default function IsraeliDateInput({
  label,
  value,
  onChange,
  required = false,
  hint,
  className = "form-input mt-1",
}: IsraeliDateInputProps) {
  const inputId = useId();
  const [display, setDisplay] = useState(() => isoToIsraeliDisplay(value));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDisplay(isoToIsraeliDisplay(value));
    setError(null);
  }, [value]);

  function commitDisplay(nextDisplay: string) {
    const trimmed = nextDisplay.trim();
    if (!trimmed) {
      setError(required ? ISRAELI_DATE_INVALID_MESSAGE : null);
      onChange("");
      return;
    }

    const iso = israeliDisplayToIso(trimmed);
    if (!iso) {
      setError(ISRAELI_DATE_INVALID_MESSAGE);
      return;
    }

    setError(null);
    setDisplay(isoToIsraeliDisplay(iso));
    onChange(iso);
  }

  return (
    <div>
      <label htmlFor={inputId} className="text-xs text-forte-text-secondary">
        {label}
      </label>
      <input
        id={inputId}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={display}
        onChange={(event) => {
          setDisplay(event.target.value);
          if (error) setError(null);
        }}
        onBlur={() => commitDisplay(display)}
        placeholder={ISRAELI_DATE_PLACEHOLDER}
        className={className}
        required={required}
        dir="ltr"
        aria-invalid={Boolean(error)}
      />
      {hint && !error && (
        <p className="text-[11px] text-forte-text-secondary mt-0.5">{hint}</p>
      )}
      {error && (
        <p className="text-[11px] text-red-600 mt-0.5">{error}</p>
      )}
    </div>
  );
}
