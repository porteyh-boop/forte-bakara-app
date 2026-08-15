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
import MasterFaultInboxPanel from "@/components/master-v2/MasterFaultInboxPanel";
import MasterFaultInboxReentryDialog from "@/components/master-v2/MasterFaultInboxReentryDialog";
import { ensureMasterV2SessionsValid } from "@/lib/master-v2-auth";
import {
  dismissMasterFaultInboxPopup,
  isMasterFaultInboxPopupDismissed,
  isMasterFaultInboxUnread,
  listMasterFaultInboxItems,
  markMasterFaultInboxRead,
  type MasterFaultInboxItem,
} from "@/lib/master-fault-inbox";
import { buildMasterProjectV2FaultPath } from "@/lib/master-project-v2-routes";
import { FORTE_V2_ROOT_CLASS } from "@/lib/forte-v2-design-system";
import { isMasterAuthenticated, isPilotCloudConfigured } from "@/lib/pilot-cloud";

const POLL_INTERVAL_MS = 30_000;

interface MasterFaultInboxContextValue {
  unreadCount: number;
  unreadItems: MasterFaultInboxItem[];
  panelOpen: boolean;
  setPanelOpen: (open: boolean) => void;
  togglePanel: () => void;
  refresh: () => Promise<void>;
  openFault: (item: MasterFaultInboxItem) => Promise<void>;
}

const MasterFaultInboxContext = createContext<MasterFaultInboxContextValue | null>(
  null
);

export function useMasterFaultInbox(): MasterFaultInboxContextValue | null {
  return useContext(MasterFaultInboxContext);
}

function pickReentryItem(items: MasterFaultInboxItem[]): MasterFaultInboxItem | null {
  const unread = items.filter(isMasterFaultInboxUnread);
  for (const item of unread) {
    if (!isMasterFaultInboxPopupDismissed(item.fault_id)) {
      return item;
    }
  }
  return null;
}

export function MasterFaultInboxProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [items, setItems] = useState<MasterFaultInboxItem[]>([]);
  const [panelOpen, setPanelOpen] = useState(false);
  const [reentryItem, setReentryItem] = useState<MasterFaultInboxItem | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const previousUnreadCountRef = useRef<number | null>(null);
  const initialLoadDoneRef = useRef(false);

  const unreadItems = useMemo(
    () => items.filter(isMasterFaultInboxUnread),
    [items]
  );
  const unreadCount = unreadItems.length;

  const refresh = useCallback(async () => {
    if (!isMasterAuthenticated() || !isPilotCloudConfigured()) {
      setItems([]);
      return;
    }

    const sessionOk = await ensureMasterV2SessionsValid();
    if (!sessionOk) {
      setItems([]);
      return;
    }

    const result = await listMasterFaultInboxItems();
    if (result.error) return;

    setItems(result.items);

    const nextUnread = result.items.filter(isMasterFaultInboxUnread).length;

    if (initialLoadDoneRef.current && previousUnreadCountRef.current != null) {
      const delta = nextUnread - previousUnreadCountRef.current;
      if (delta > 0) {
        setToastMessage(
          delta === 1
            ? "התקבל דיווח תקלה חדש"
            : `התקבלו ${delta} דיווחי תקלה חדשים`
        );
      }
    }

    previousUnreadCountRef.current = nextUnread;

    const isFirstLoad = !initialLoadDoneRef.current;
    initialLoadDoneRef.current = true;
    if (isFirstLoad) {
      setReentryItem(pickReentryItem(result.items));
    }
  }, []);

  const openFault = useCallback(
    async (item: MasterFaultInboxItem) => {
      const buildingId = item.building_id.trim().toLowerCase();
      const faultId = item.fault_id;

      setPanelOpen(false);
      setReentryItem(null);

      await markMasterFaultInboxRead({ inboxId: item.id, faultId });

      setItems((current) =>
        current.map((row) =>
          row.id === item.id
            ? { ...row, read_at: row.read_at ?? new Date().toISOString() }
            : row
        )
      );
      previousUnreadCountRef.current = Math.max(
        0,
        (previousUnreadCountRef.current ?? unreadCount) - 1
      );

      router.push(buildMasterProjectV2FaultPath(buildingId, faultId));
    },
    [router, unreadCount]
  );

  function handleDismissReentry() {
    if (!reentryItem) return;
    dismissMasterFaultInboxPopup(reentryItem.fault_id);
    setReentryItem(null);
  }

  useEffect(() => {
    if (!isMasterAuthenticated()) return;

    void refresh();

    const intervalId = window.setInterval(() => {
      void refresh();
    }, POLL_INTERVAL_MS);

    function handleFocus() {
      void refresh();
    }

    window.addEventListener("focus", handleFocus);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", handleFocus);
    };
  }, [refresh]);

  useEffect(() => {
    if (!toastMessage) return;
    const timeoutId = window.setTimeout(() => setToastMessage(null), 5000);
    return () => window.clearTimeout(timeoutId);
  }, [toastMessage]);

  const value = useMemo<MasterFaultInboxContextValue>(
    () => ({
      unreadCount,
      unreadItems,
      panelOpen,
      setPanelOpen,
      togglePanel: () => setPanelOpen((current) => !current),
      refresh,
      openFault,
    }),
    [unreadCount, unreadItems, panelOpen, refresh, openFault]
  );

  return (
    <MasterFaultInboxContext.Provider value={value}>
      {children}

      {toastMessage && (
        <div className={FORTE_V2_ROOT_CLASS}>
          <div className="fv2-fault-inbox-toast" role="status">
            <p className="text-sm font-medium text-forte-text">{toastMessage}</p>
            <button
              type="button"
              className="text-xs font-semibold text-forte-primary hover:underline"
              onClick={() => setPanelOpen(true)}
            >
              הצג
            </button>
          </div>
        </div>
      )}

      {panelOpen && (
        <div className={`${FORTE_V2_ROOT_CLASS} fv2-fault-inbox-overlay-root`}>
          <MasterFaultInboxPanel
            items={unreadItems}
            onClose={() => setPanelOpen(false)}
            onOpenFault={(item) => void openFault(item)}
          />
        </div>
      )}

      {reentryItem && !panelOpen && (
        <div className={`${FORTE_V2_ROOT_CLASS} fv2-fault-inbox-overlay-root`}>
          <MasterFaultInboxReentryDialog
            item={reentryItem}
            onOpen={() => void openFault(reentryItem)}
            onDismiss={handleDismissReentry}
          />
        </div>
      )}
    </MasterFaultInboxContext.Provider>
  );
}
