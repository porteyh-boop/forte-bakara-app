"use client";

import { useEffect, useState } from "react";
import {
  resolveClientPortalViewModeInBrowser,
  type ClientPortalViewMode,
} from "@/lib/client-portal-view-mode";

export function useClientPortalViewMode(
  serverInitial: ClientPortalViewMode
): ClientPortalViewMode {
  const [mode, setMode] = useState<ClientPortalViewMode>(serverInitial);

  useEffect(() => {
    setMode(resolveClientPortalViewModeInBrowser());
  }, [serverInitial]);

  return mode;
}
