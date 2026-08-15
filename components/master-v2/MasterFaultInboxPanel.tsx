"use client";

import StatusBadge from "@/components/StatusBadge";
import {
  formatMasterFaultInboxTimestamp,
  summarizeMasterFaultInboxDescription,
  type MasterFaultInboxItem,
} from "@/lib/master-fault-inbox";
import {
  ForteV2Dialog,
  ForteV2DialogOverlay,
  ForteV2SecondaryButton,
} from "@/components/master-v2/project-v2/MasterProjectV2Workspace";

interface MasterFaultInboxPanelProps {
  items: MasterFaultInboxItem[];
  onClose: () => void;
  onOpenFault: (item: MasterFaultInboxItem) => void;
}

export default function MasterFaultInboxPanel({
  items,
  onClose,
  onOpenFault,
}: MasterFaultInboxPanelProps) {
  return (
    <ForteV2DialogOverlay onClose={onClose}>
      <ForteV2Dialog title="התראות תקלות" onClose={onClose} size="lg">
        {items.length === 0 ? (
          <p className="text-sm text-forte-text-secondary py-6 text-center">
            אין התראות חדשות.
          </p>
        ) : (
          <ul className="space-y-2 max-h-[min(60vh,24rem)] overflow-y-auto">
            {items.map((item) => (
              <li
                key={item.id}
                className="rounded-lg border border-forte-border bg-white px-3 py-2.5 space-y-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 text-right">
                    <p className="text-sm font-semibold text-forte-text truncate">
                      {item.building_name}
                    </p>
                    {item.elevator_name ? (
                      <p className="text-xs text-forte-text-secondary">
                        מעלית: {item.elevator_name}
                      </p>
                    ) : null}
                    <p className="text-xs text-forte-text-secondary">
                      {formatMasterFaultInboxTimestamp(item.fault_created_at)}
                    </p>
                  </div>
                  <StatusBadge status={item.status as "פתוחה"} pulse={false} />
                </div>
                <p className="text-xs text-forte-text/90">
                  {summarizeMasterFaultInboxDescription(item.description)}
                </p>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => onOpenFault(item)}
                    className="text-xs font-semibold text-forte-primary hover:underline"
                  >
                    פתח
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
        <div className="flex justify-end pt-2">
          <ForteV2SecondaryButton onClick={onClose} size="sm">
            סגור
          </ForteV2SecondaryButton>
        </div>
      </ForteV2Dialog>
    </ForteV2DialogOverlay>
  );
}
