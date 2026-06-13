"use client";

import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
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

export default function ClientPortalInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [showIosHint, setShowIosHint] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    if (isStandaloneDisplay()) {
      setInstalled(true);
      return;
    }

    function handleBeforeInstall(event: Event) {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
    };
  }, []);

  if (installed) return null;

  async function handleInstall() {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      setDeferredPrompt(null);
      return;
    }

    if (isIosDevice()) {
      setShowIosHint((value) => !value);
    }
  }

  const canShowButton = Boolean(deferredPrompt) || isIosDevice();
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
        </p>
      )}
    </div>
  );
}
