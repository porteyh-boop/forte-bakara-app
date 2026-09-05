"use client";

import {
  ForteV2Dialog,
  ForteV2DialogOverlay,
  ForteV2PrimaryButton,
  ForteV2SecondaryButton,
} from "@/components/master-v2/project-v2/MasterProjectV2Workspace";
import {
  SALES_LEAD_NOTIFICATION_OPEN_LABEL,
  salesLeadNotificationTitle,
  type SalesLeadNotificationRecord,
} from "@/lib/sales-lead-notifications";

interface MasterSalesLeadNotificationPopupProps {
  item: SalesLeadNotificationRecord;
  onOpen: () => void;
  onDismiss: () => void;
}

export default function MasterSalesLeadNotificationPopup({
  item,
  onOpen,
  onDismiss,
}: MasterSalesLeadNotificationPopupProps) {
  return (
    <ForteV2DialogOverlay onClose={onDismiss}>
      <ForteV2Dialog
        title={salesLeadNotificationTitle(item.eventKind)}
        onClose={onDismiss}
        size="md"
      >
        <div className="space-y-2 text-right">
          <p className="text-sm text-forte-text">
            <span className="text-forte-text-secondary">שם הלקוח/החברה: </span>
            {item.clientName || "—"}
          </p>
          <p className="text-sm text-forte-text">
            <span className="text-forte-text-secondary">איש קשר: </span>
            {item.contactName || "—"}
          </p>
          <p className="text-sm text-forte-text">
            <span className="text-forte-text-secondary">טלפון: </span>
            {item.phone || "—"}
          </p>
        </div>
        <div className="flex gap-2 justify-end pt-4">
          <ForteV2PrimaryButton onClick={onOpen} size="sm">
            {SALES_LEAD_NOTIFICATION_OPEN_LABEL}
          </ForteV2PrimaryButton>
          <ForteV2SecondaryButton onClick={onDismiss} size="sm">
            סגור
          </ForteV2SecondaryButton>
        </div>
      </ForteV2Dialog>
    </ForteV2DialogOverlay>
  );
}
