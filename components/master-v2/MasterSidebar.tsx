"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useMasterFaultInbox } from "@/components/master-v2/MasterFaultInboxProvider";
import { BRAND_EDITOR_NAME, BRAND_FORTE } from "@/lib/brand";
import {
  buildMasterProjectV2Path,
  MASTER_BUSINESS_PATH,
  type ProjectV2TabId,
} from "@/lib/master-project-v2-routes";
import {
  getTabsForProjectType,
  type ProjectTypeId,
} from "@/lib/project-type-config";

function SidebarNotificationsButton({
  unreadCount,
  onClick,
}: {
  unreadCount: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="fv2-sidebar-item w-full relative"
      aria-label="התראות"
      onClick={onClick}
    >
      <span className="fv2-sidebar-icon" aria-hidden>
        🔔
      </span>
      <span>התראות</span>
      {unreadCount > 0 ? (
        <span className="fv2-sidebar-bell-badge" aria-hidden>
          {unreadCount}
        </span>
      ) : null}
    </button>
  );
}

type SidebarItem = {
  id: string;
  label: string;
  icon: string;
  href?: string;
  disabled?: boolean;
  tabId?: ProjectV2TabId;
  section?: "main" | "project" | "system";
};

const STATION_ITEMS: SidebarItem[] = [
  { id: "execution", label: "שלב ביצוע", icon: "📈", tabId: "execution", section: "project" },
  { id: "finances", label: "כספים", icon: "💰", tabId: "finances", section: "project" },
  { id: "documents", label: "מסמכים", icon: "📄", tabId: "documents", section: "project" },
  { id: "letters", label: "מכתבים", icon: "✉", tabId: "letters", section: "project" },
  { id: "inspections", label: "בדיקות", icon: "🔍", tabId: "inspections", section: "project" },
  { id: "faults", label: "תקלות", icon: "⚠", tabId: "faults", section: "project" },
  { id: "contacts", label: "אנשי קשר", icon: "👥", tabId: "contacts", section: "project" },
  { id: "tasks", label: "משימות", icon: "☑", tabId: "tasks", section: "project" },
  { id: "ai", label: "AI Assistant", icon: "✦", tabId: "ai", section: "project" },
  { id: "permissions", label: "הרשאות", icon: "🔐", tabId: "permissions", section: "project" },
];

const BOTTOM_ITEMS: SidebarItem[] = [];

export interface MasterSidebarProjectNav {
  buildingId: string;
  activeTab: ProjectV2TabId | "details";
  projectType?: ProjectTypeId;
}

interface MasterSidebarProps {
  activeItemId?: string;
  onLogout: () => void;
  projectNav?: MasterSidebarProjectNav;
  open?: boolean;
  onNavigate?: () => void;
}

const GLOBAL_ITEMS: SidebarItem[] = [
  { id: "contacts-directory", label: "ספר אנשי קשר", icon: "📇", href: "/master/contacts", section: "main" },
];

function resolveActiveItemId(
  activeItemId: string,
  projectNav?: MasterSidebarProjectNav
): string {
  if (projectNav && projectNav.activeTab !== "details") {
    return projectNav.activeTab;
  }
  return activeItemId;
}

function SidebarNavItem({
  item,
  isActive,
  onNavigate,
}: {
  item: SidebarItem;
  isActive: boolean;
  onNavigate?: () => void;
}) {
  const className = [
    "fv2-sidebar-item",
    isActive ? "fv2-sidebar-item-active" : "",
    item.disabled ? "fv2-sidebar-item-disabled" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const content = (
    <>
      <span className="fv2-sidebar-icon" aria-hidden>
        {item.icon}
      </span>
      <span>{item.label}</span>
    </>
  );

  if (item.disabled || !item.href) {
    return (
      <span key={item.id} className={className} aria-disabled="true">
        {content}
      </span>
    );
  }

  return (
    <Link key={item.id} href={item.href} className={className} onClick={onNavigate}>
      {content}
    </Link>
  );
}

export default function MasterSidebar({
  activeItemId = "projects",
  onLogout,
  projectNav,
  open = false,
  onNavigate,
}: MasterSidebarProps) {
  const inbox = useMasterFaultInbox();
  const [clientReady, setClientReady] = useState(false);

  useEffect(() => {
    setClientReady(true);
  }, []);

  const resolvedActiveId = resolveActiveItemId(activeItemId, projectNav);

  const mainItems: SidebarItem[] = [
    { id: "projects", label: "פרויקטים", icon: "▦", href: "/master?ui=v2", section: "main" },
    { id: "business", label: "עסקי", icon: "💼", href: MASTER_BUSINESS_PATH, section: "main" },
  ];

  const projectItems: SidebarItem[] = useMemo(() => {
    if (!clientReady || !projectNav?.buildingId) return [];

    return STATION_ITEMS.filter((item) => {
      if (!item.tabId) return false;
      const allowedTabs = getTabsForProjectType(projectNav.projectType ?? "standard");
      return allowedTabs.includes(item.tabId);
    }).map((item) => ({
      ...item,
      href: item.tabId
        ? buildMasterProjectV2Path(projectNav.buildingId, item.tabId)
        : undefined,
    }));
  }, [clientReady, projectNav]);

  const userInitials = BRAND_EDITOR_NAME.slice(0, 2).toUpperCase();

  return (
    <aside
      id="fv2-sidebar"
      className={`fv2-sidebar${open ? " fv2-sidebar-open" : ""}`}
    >
      <div className="fv2-sidebar-brand">
        <div className="fv2-sidebar-brand-row">
          <div className="fv2-sidebar-brand-text">
            <div className="fv2-sidebar-brand-mark" aria-hidden>
              F
            </div>
            <p className="fv2-sidebar-brand-title">{BRAND_FORTE}</p>
            <p className="fv2-sidebar-brand-sub">מערכת ניהול הנדסי</p>
          </div>
          <button
            type="button"
            className="fv2-sidebar-close"
            aria-label="סגור תפריט"
            onClick={onNavigate}
          >
            ✕
          </button>
        </div>
      </div>

      <nav className="fv2-sidebar-nav">
        <p className="fv2-sidebar-section-label">ראשי</p>
        {mainItems.map((item) => (
          <SidebarNavItem
            key={item.id}
            item={item}
            isActive={item.id === resolvedActiveId}
            onNavigate={onNavigate}
          />
        ))}
        <SidebarNotificationsButton
          unreadCount={inbox?.unreadCount ?? 0}
          onClick={() => {
            onNavigate?.();
            inbox?.togglePanel();
          }}
        />
        {GLOBAL_ITEMS.map((item) => (
          <SidebarNavItem
            key={item.id}
            item={item}
            isActive={item.id === resolvedActiveId}
            onNavigate={onNavigate}
          />
        ))}

        <p className="fv2-sidebar-section-label">תיק פרויקט</p>
        {projectItems.map((item) => (
          <SidebarNavItem
            key={item.id}
            item={item}
            isActive={item.id === resolvedActiveId}
            onNavigate={onNavigate}
          />
        ))}

        {BOTTOM_ITEMS.length > 0 ? (
          <>
            <p className="fv2-sidebar-section-label">מערכת</p>
            {BOTTOM_ITEMS.map((item) => (
              <SidebarNavItem
                key={item.id}
                item={item}
                isActive={item.id === resolvedActiveId}
                onNavigate={onNavigate}
              />
            ))}
          </>
        ) : null}
      </nav>

      <div className="fv2-sidebar-footer">
        <div className="fv2-sidebar-user">
          <div className="fv2-sidebar-avatar" aria-hidden>
            {userInitials}
          </div>
          <div className="min-w-0">
            <p className="fv2-sidebar-user-name truncate">{BRAND_EDITOR_NAME}</p>
            <p className="fv2-sidebar-user-role">מנהל מערכת</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            onNavigate?.();
            onLogout();
          }}
          className="fv2-sidebar-item w-full"
        >
          <span className="fv2-sidebar-icon" aria-hidden>
            ⎋
          </span>
          <span>יציאה</span>
        </button>
      </div>
    </aside>
  );
}
