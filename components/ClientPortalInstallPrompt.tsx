"use client";

import { useEffect, useState } from "react";
import { buildClientPortalManifestPath } from "@/lib/client-portal-manifest";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

interface ClientPortalInstallPromptProps {
  token: string;
}

function isIosDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isStandaloneDisplay(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator &&
      Boolean((navigator as Navigator & { standalone?: boolean }).standalone))
  );
}

function readActiveManifestHref(): string | null {
  if (typeof document === "undefined") return null;
  return document.querySelector('link[rel="manifest"]')?.getAttribute("href") ?? null;
}

export default function ClientPortalInstallPrompt({
  token,
}: ClientPortalInstallPromptProps) {
  const expectedManifestPath = buildClientPortalManifestPath(token);
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [showIosHint, setShowIosHint] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [manifestReady, setManifestReady] = useState(false);

  useEffect(() => {
    if (isStandaloneDisplay()) {
      setInstalled(true);
      return;
    }

    function syncManifestReady() {
      setManifestReady(readActiveManifestHref() === expectedManifestPath);
    }

    syncManifestReady();

    function handleBeforeInstall(event: Event) {
      syncManifestReady();
      if (readActiveManifestHref() !== expectedManifestPath) {
        return;
      }
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    }

    const observer = new MutationObserver(syncManifestReady);
    observer.observe(document.head, { childList: true, subtree: true });

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    return () => {
      observer.disconnect();
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
    };
  }, [expectedManifestPath]);

  if (installed) return null;

  async function handleInstall() {
    if (deferredPrompt && manifestReady) {
      await deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      setDeferredPrompt(null);
      return;
    }

    if (isIosDevice()) {
      setShowIosHint((value) => !value);
    }
  }

  const canShowAndroidInstall = Boolean(deferredPrompt) && manifestReady;
  const canShowButton = canShowAndroidInstall || isIosDevice();
  if (!canShowButton) return null;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-2">
      <p className="text-sm font-semibold text-navy">התקנת פורטל בטלפון</p>
      <p className="text-xs text-gray-text">
        שמרו גישה מהירה לפורטל ישירות ממסך הבית.
      </p>
      <button
        type="button"
        onClick={() => void handleInstall()}
        className="btn-primary w-full"
      >
        הוסף למסך הבית
      </button>
      {showIosHint && (
        <p className="text-xs text-gray-text bg-gray-light rounded-lg px-3 py-2">
          ב-iPhone/iPad: לחצו על שיתוף (Share) ובחרו &quot;הוסף למסך הבית&quot;.
          הקיצור ישמור את הקישור האישי שלכם לפורטל.
        </p>
      )}
    </div>
  );
}
