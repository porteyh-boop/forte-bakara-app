"use client";

import { useEffect, useState } from "react";
import "@/app/forte-v2-design-system.css";
import { MasterFaultInboxProvider } from "@/components/master-v2/MasterFaultInboxProvider";
import { MasterSalesLeadNotificationsProvider } from "@/components/master-v2/MasterSalesLeadNotificationsProvider";
import MasterSidebar, {
  type MasterSidebarProjectNav,
} from "@/components/master-v2/MasterSidebar";
import { FORTE_V2_ROOT_CLASS } from "@/lib/forte-v2-design-system";

const DESKTOP_MIN_WIDTH_MQ = "(min-width: 1280px)";

interface MasterShellLayoutProps {
  children: React.ReactNode;
  onLogout: () => void;
  projectNav?: MasterSidebarProjectNav;
  activeItemId?: string;
}

export default function MasterShellLayout({
  children,
  onLogout,
  projectNav,
  activeItemId,
}: MasterShellLayoutProps) {
  const [navOpen, setNavOpen] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(DESKTOP_MIN_WIDTH_MQ);
    const closeOnDesktop = () => {
      if (mq.matches) setNavOpen(false);
    };
    closeOnDesktop();
    mq.addEventListener("change", closeOnDesktop);
    return () => mq.removeEventListener("change", closeOnDesktop);
  }, []);

  useEffect(() => {
    if (!navOpen) return undefined;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setNavOpen(false);
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [navOpen]);

  function closeNav() {
    setNavOpen(false);
  }

  return (
    <MasterFaultInboxProvider>
    <MasterSalesLeadNotificationsProvider>
      <div
        className={`min-h-screen bg-forte-background flex flex-col ${FORTE_V2_ROOT_CLASS}`}
      >
        <header className="fv2-mobile-topbar">
          <button
            type="button"
            className="fv2-menu-toggle"
            aria-label="פתח תפריט"
            aria-expanded={navOpen}
            aria-controls="fv2-sidebar"
            onClick={() => setNavOpen(true)}
          >
            <span aria-hidden>☰</span>
          </button>
          <p className="fv2-mobile-topbar-title">FORTE</p>
        </header>

        <div className="flex flex-row flex-1 min-h-0 min-w-0">
          {navOpen ? (
            <button
              type="button"
              className="fv2-nav-backdrop"
              aria-label="סגור תפריט"
              onClick={closeNav}
            />
          ) : null}
          <MasterSidebar
            open={navOpen}
            onNavigate={closeNav}
            onLogout={onLogout}
            projectNav={projectNav}
            activeItemId={activeItemId}
          />
          <main className="flex-1 min-w-0 flex flex-col">{children}</main>
        </div>
      </div>
    </MasterSalesLeadNotificationsProvider>
    </MasterFaultInboxProvider>
  );
}
