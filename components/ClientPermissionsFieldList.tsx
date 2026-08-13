"use client";

import {
  CLIENT_PERMISSION_LABELS,
  CLIENT_PERMISSION_UI_KEYS,
  type ClientPermissionFlags,
  type ClientPermissionKey,
} from "@/lib/client-permissions";

interface ClientPermissionsFieldListProps {
  flags: ClientPermissionFlags;
  onToggle: (key: ClientPermissionKey) => void;
  disabled?: boolean;
  compact?: boolean;
}

export default function ClientPermissionsFieldList({
  flags,
  onToggle,
  disabled = false,
  compact = false,
}: ClientPermissionsFieldListProps) {
  return (
    <div className={compact ? "space-y-2" : "space-y-3"}>
      {CLIENT_PERMISSION_UI_KEYS.map((key) => {
        const isNotifications = key === "can_receive_notifications";
        const rowDisabled = disabled || isNotifications;

        return (
          <label
            key={key}
            className={`flex items-center justify-between gap-3 rounded-md border border-gray-200 px-3 ${
              compact ? "py-2" : "py-2.5"
            } ${rowDisabled && isNotifications ? "opacity-70 bg-gray-50" : ""}`}
          >
            <span className="text-xs text-navy">
              {CLIENT_PERMISSION_LABELS[key]}
              {isNotifications && (
                <span className="block text-[10px] text-amber-800 mt-0.5">
                  לא פעיל כרגע — שליחת התראות ללקוח אינה מחוברת
                </span>
              )}
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={flags[key]}
              aria-disabled={rowDisabled}
              disabled={rowDisabled}
              onClick={() => onToggle(key)}
              className={`relative w-11 h-6 rounded-full transition-colors shrink-0 disabled:cursor-not-allowed ${
                flags[key] ? "bg-navy" : "bg-gray-300"
              }`}
            >
              <span
                className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all duration-200 ${
                  flags[key] ? "end-0.5" : "end-5"
                }`}
              />
            </button>
          </label>
        );
      })}
    </div>
  );
}
