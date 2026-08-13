"use client";

import Link from "next/link";
import { BRAND_EDITOR_NAME, BRAND_FORTE } from "@/lib/brand";
import {
  buildMasterProjectV2Path,
  type ProjectV2TabId,
} from "@/lib/master-project-v2-routes";

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
  { id: "letters", label: "מכתבים", icon: "✉", tabId: "letters", section: "project" },
  { id: "inspections", label: "בדיקות", icon: "🔍", tabId: "inspections", section: "project" },
  { id: "faults", label: "תקלות", icon: "⚠", tabId: "faults", section: "project" },
  { id: "contacts", label: "אנשי קשר", icon: "👥", tabId: "contacts", section: "project" },
  { id: "tasks", label: "משימות", icon: "☑", tabId: "tasks", section: "project" },
  { id: "reports", label: "דוחות", icon: "📊", tabId: "reports", section: "project" },
  { id: "ai", label: "AI Assistant", icon: "✦", tabId: "ai", section: "project" },
  { id: "permissions", label: "הרשאות", icon: "🔐", tabId: "permissions", section: "project" },
];

const BOTTOM_ITEMS: SidebarItem[] = [
  { id: "settings", label: "הגדרות", icon: "⚙", tabId: "settings", disabled: true, section: "system" },
];

export interface MasterSidebarProjectNav {
  buildingId: string;
  activeTab: ProjectV2TabId | "details";
}

interface MasterSidebarProps {
  activeItemId?: string;
  onLogout: () => void;
  projectNav?: MasterSidebarProjectNav;
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
}: {
  item: SidebarItem;
  isActive: boolean;
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
    <Link key={item.id} href={item.href} className={className}>
      {content}
    </Link>
  );
}

export default function MasterSidebar({
  activeItemId = "projects",
  onLogout,
  projectNav,
}: MasterSidebarProps) {
  const resolvedActiveId = resolveActiveItemId(activeItemId, projectNav);

  const mainItems: SidebarItem[] = [
    { id: "projects", label: "פרויקטים", icon: "▦", href: "/master?ui=v2", section: "main" },
    ...GLOBAL_ITEMS,
  ];

  const projectItems: SidebarItem[] = STATION_ITEMS.map((item) => {
    if (projectNav?.buildingId && item.tabId) {
      return {
        ...item,
        href: buildMasterProjectV2Path(projectNav.buildingId, item.tabId),
      };
    }
    return { ...item, disabled: true };
  });

  const userInitials = BRAND_EDITOR_NAME.slice(0, 2).toUpperCase();

  return (
    <aside className="fv2-sidebar">
      <div className="fv2-sidebar-brand">
        <div className="fv2-sidebar-brand-mark" aria-hidden>
          F
        </div>
        <p className="fv2-sidebar-brand-title">{BRAND_FORTE}</p>
        <p className="fv2-sidebar-brand-sub">מערכת ניהול הנדסי</p>
      </div>

      <nav className="fv2-sidebar-nav">
        <p className="fv2-sidebar-section-label">ראשי</p>
        {mainItems.map((item) => (
          <SidebarNavItem key={item.id} item={item} isActive={item.id === resolvedActiveId} />
        ))}

        <p className="fv2-sidebar-section-label">תיק פרויקט</p>
        {projectItems.map((item) => (
          <SidebarNavItem key={item.id} item={item} isActive={item.id === resolvedActiveId} />
        ))}

        <p className="fv2-sidebar-section-label">מערכת</p>
        {BOTTOM_ITEMS.map((item) => (
          <SidebarNavItem key={item.id} item={item} isActive={item.id === resolvedActiveId} />
        ))}
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
        <button type="button" className="fv2-sidebar-item w-full" aria-label="התראות">
          <span className="fv2-sidebar-icon" aria-hidden>
            🔔
          </span>
          <span>התראות</span>
        </button>
        <button type="button" onClick={onLogout} className="fv2-sidebar-item w-full">
          <span className="fv2-sidebar-icon" aria-hidden>
            ⎋
          </span>
          <span>יציאה</span>
        </button>
      </div>
    </aside>
  );
}
