"use client";

import { useEffect } from "react";
import { buildClientPortalManifestPath } from "@/lib/client-portal-manifest";

interface ClientPortalManifestBinderProps {
  token: string;
}

/**
 * Ensures the active document manifest is token-scoped on Client Portal pages.
 * Removes the global FORTE manifest link so Android install uses the portal URL.
 */
export default function ClientPortalManifestBinder({
  token,
}: ClientPortalManifestBinderProps) {
  useEffect(() => {
    const href = buildClientPortalManifestPath(token);
    document.querySelectorAll('link[rel="manifest"]').forEach((link) => {
      if (link.getAttribute("href") !== href) {
        link.remove();
      }
    });

    const existing = document.querySelector(
      `link[rel="manifest"][href="${href}"]`
    );
    if (!existing) {
      const link = document.createElement("link");
      link.rel = "manifest";
      link.href = href;
      document.head.appendChild(link);
    }
  }, [token]);

  return null;
}
