"use client";

import {
  ForteV2Dialog,
  ForteV2DialogOverlay,
  ForteV2PrimaryButton,
  ForteV2SecondaryButton,
} from "@/components/master-v2/project-v2/MasterProjectV2Workspace";
import type { MasterFaultInboxItem } from "@/lib/master-fault-inbox";

interface MasterFaultInboxReentryDialogProps {
  item: MasterFaultInboxItem;
  onOpen: () => void;
  onDismiss: () => void;
}

export default function MasterFaultInboxReentryDialog({
  item,
  onOpen,
  onDismiss,
}: MasterFaultInboxReentryDialogProps) {
  return (
    <ForteV2DialogOverlay onClose={onDismiss}>
      <ForteV2Dialog title="דיווח תקלה חדש" onClose={onDismiss} size="md">
        <div className="space-y-3 text-right">
          <p className="text-sm text-forte-text">התקבל דיווח חדש על תקלה</p>
          <p className="text-sm font-semibold text-forte-text">
            פרויקט: {item.building_name}
          </p>
          {item.elevator_name ? (
            <p className="text-xs text-forte-text-secondary">
              מעלית: {item.elevator_name}
            </p>
          ) : null}
          <p className="text-xs text-forte-text-secondary">האם לפתוח?</p>
        </div>
        <div className="flex gap-2 justify-end pt-4">
          <ForteV2PrimaryButton onClick={onOpen} size="sm">
            פתח
          </ForteV2PrimaryButton>
          <ForteV2SecondaryButton onClick={onDismiss} size="sm">
            אחר כך
          </ForteV2SecondaryButton>
        </div>
      </ForteV2Dialog>
    </ForteV2DialogOverlay>
  );
}
