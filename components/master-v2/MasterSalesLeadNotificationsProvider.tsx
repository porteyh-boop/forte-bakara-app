"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import MasterSalesLeadNotificationPopup from "@/components/master-v2/MasterSalesLeadNotificationPopup";
import { FORTE_V2_ROOT_CLASS } from "@/lib/forte-v2-design-system";
import { ensureMasterV2SessionsValid } from "@/lib/master-v2-auth";
import { isMasterAuthenticated } from "@/lib/pilot-cloud";
import {
  buildMasterSalesLeadPath,
  findNewSalesLeadNotifications,
  isSalesLeadNotificationUnread,
  listSalesLeadNotifications,
  markSalesLeadNotificationRead,
  parseSalesLeadIdParam,
  pickSalesLeadNotificationPopup,
  SALES_LEAD_NOTIFICATIONS_POLL_MS,
  type SalesLeadNotificationRecord,
} from "@/lib/sales-lead-notifications";

function currentOpenSalesLeadId(): string | null {
  if (typeof window === "undefined") return null;
  return parseSalesLeadIdParam(
    new URLSearchParams(window.location.search).get("leadId")
  );
}

interface MasterSalesLeadNotificationsContextValue {
  unreadCount: number;
  unreadItems: SalesLeadNotificationRecord[];
  refresh: () => Promise<void>;
  markLeadRead: (leadId: string) => Promise<void>;
  openNotification: (item: SalesLeadNotificationRecord) => Promise<void>;
}

const MasterSalesLeadNotificationsContext =
  createContext<MasterSalesLeadNotificationsContextValue | null>(null);

export function useMasterSalesLeadNotifications(): MasterSalesLeadNotificationsContextValue | null {
  return useContext(MasterSalesLeadNotificationsContext);
}

export function MasterSalesLeadNotificationsProvider({
  children,
}: {
  children: ReactNode;
}) {
  const router = useRouter();
  const [items, setItems] = useState<SalesLeadNotificationRecord[]>([]);
  const [popup, setPopup] = useState<SalesLeadNotificationRecord | null>(null);
  const itemsRef = useRef<SalesLeadNotificationRecord[]>([]);
  const shownIdsRef = useRef<Set<string>>(new Set());
  const initialLoadDoneRef = useRef(false);

  const unreadItems = useMemo(
    () => items.filter(isSalesLeadNotificationUnread),
    [items]
  );
  const unreadCount = unreadItems.length;

  const applyItems = useCallback((nextItems: SalesLeadNotificationRecord[]) => {
    const previous = itemsRef.current;
    const isFirstLoad = !initialLoadDoneRef.current;
    const newcomers = isFirstLoad
      ? nextItems
      : findNewSalesLeadNotifications(previous, nextItems);

    itemsRef.current = nextItems;
    setItems(nextItems);
    initialLoadDoneRef.current = true;

    const candidate = pickSalesLeadNotificationPopup(
      isFirstLoad ? nextItems : newcomers,
      shownIdsRef.current
    );
    if (candidate) {
      shownIdsRef.current.add(candidate.id);
      if (candidate.leadId === currentOpenSalesLeadId()) {
        return;
      }
      setPopup((current) => current ?? candidate);
    }
  }, []);

  const refresh = useCallback(async () => {
    if (!isMasterAuthenticated()) {
      itemsRef.current = [];
      setItems([]);
      return;
    }
    if (typeof document !== "undefined" && document.visibilityState !== "visible") {
      return;
    }

    const sessionOk = await ensureMasterV2SessionsValid();
    if (!sessionOk) {
      itemsRef.current = [];
      setItems([]);
      return;
    }

    const result = await listSalesLeadNotifications({ unreadOnly: true });
    if (result.error) return;
    applyItems(result.items);
  }, [applyItems]);

  const markLocalRead = useCallback((matcher: (item: SalesLeadNotificationRecord) => boolean) => {
    setItems((current) => {
      const readAt = new Date().toISOString();
      const updated = current.map((item) =>
        matcher(item) && !item.readAt ? { ...item, readAt } : item
      );
      itemsRef.current = updated;
      return updated;
    });
  }, []);

  const markLeadRead = useCallback(
    async (leadId: string) => {
      markLocalRead((item) => item.leadId === leadId);
      setPopup((current) => (current?.leadId === leadId ? null : current));
      await markSalesLeadNotificationRead({ leadId });
    },
    [markLocalRead]
  );

  const openNotification = useCallback(
    async (item: SalesLeadNotificationRecord) => {
      shownIdsRef.current.add(item.id);
      setPopup(null);
      markLocalRead((row) => row.id === item.id);
      await markSalesLeadNotificationRead({ notificationId: item.id });
      router.push(buildMasterSalesLeadPath(item.leadId));
    },
    [markLocalRead, router]
  );

  async function handleDismiss() {
    if (!popup) return;
    shownIdsRef.current.add(popup.id);
    markLocalRead((row) => row.id === popup.id);
    const id = popup.id;
    setPopup(null);
    await markSalesLeadNotificationRead({ notificationId: id });
  }

  useEffect(() => {
    if (!isMasterAuthenticated()) return;

    void refresh();

    let intervalId: number | null = null;

    function startPolling() {
      if (intervalId != null) return;
      intervalId = window.setInterval(() => {
        void refresh();
      }, SALES_LEAD_NOTIFICATIONS_POLL_MS);
    }

    function stopPolling() {
      if (intervalId == null) return;
      window.clearInterval(intervalId);
      intervalId = null;
    }

    function handleVisibility() {
      if (document.visibilityState === "visible") {
        void refresh();
        startPolling();
      } else {
        stopPolling();
      }
    }

    if (document.visibilityState === "visible") {
      startPolling();
    }

    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      stopPolling();
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [refresh]);

  const value = useMemo<MasterSalesLeadNotificationsContextValue>(
    () => ({
      unreadCount,
      unreadItems,
      refresh,
      markLeadRead,
      openNotification,
    }),
    [unreadCount, unreadItems, refresh, markLeadRead, openNotification]
  );

  return (
    <MasterSalesLeadNotificationsContext.Provider value={value}>
      {children}
      {popup ? (
        <div className={`${FORTE_V2_ROOT_CLASS} fv2-fault-inbox-overlay-root`}>
          <MasterSalesLeadNotificationPopup
            item={popup}
            onOpen={() => void openNotification(popup)}
            onDismiss={() => void handleDismiss()}
          />
        </div>
      ) : null}
    </MasterSalesLeadNotificationsContext.Provider>
  );
}
