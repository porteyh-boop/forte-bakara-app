"use client";

import "@/app/forte-v2-design-system.css";
import MasterSidebar, {
  type MasterSidebarProjectNav,
} from "@/components/master-v2/MasterSidebar";
import { FORTE_V2_ROOT_CLASS } from "@/lib/forte-v2-design-system";

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
  return (
    <div className={`min-h-screen bg-forte-background flex flex-row ${FORTE_V2_ROOT_CLASS}`}>
      <MasterSidebar
        onLogout={onLogout}
        projectNav={projectNav}
        activeItemId={activeItemId}
      />
      <main className="flex-1 min-w-0 flex flex-col">{children}</main>
    </div>
  );
}
