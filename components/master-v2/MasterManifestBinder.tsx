"use client";

import { useEffect } from "react";
import {
  MASTER_MANIFEST_PATH,
  isMasterStandaloneDisplay,
  resolveMasterStandaloneStartUrl,
} from "@/lib/master-manifest";

/**
 * Points /master (and subpages) at the dedicated Master V2 manifest so
 * iOS "Add to Home Screen" does not inherit the global start_url "/".
 */
export default function MasterManifestBinder() {
  useEffect(() => {
    document.querySelectorAll('link[rel="manifest"]').forEach((link) => {
      if (link.getAttribute("href") !== MASTER_MANIFEST_PATH) {
        link.remove();
      }
    });

    const existing = document.querySelector(
      `link[rel="manifest"][href="${MASTER_MANIFEST_PATH}"]`
    );
    if (!existing) {
      const link = document.createElement("link");
      link.rel = "manifest";
      link.href = MASTER_MANIFEST_PATH;
      document.head.appendChild(link);
    }

    if (!isMasterStandaloneDisplay()) return;

    const nextUrl = resolveMasterStandaloneStartUrl(
      window.location.pathname,
      window.location.search
    );
    if (nextUrl && nextUrl !== `${window.location.pathname}${window.location.search}`) {
      window.history.replaceState(window.history.state, "", nextUrl);
    }
  }, []);

  return null;
}
