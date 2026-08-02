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
import {
  CURRENT_BUILD_VERSION,
  fetchServerVersion,
  formatDisplayVersion,
  isVersionCheckEnabled,
  VERSION_INITIAL_CHECK_DELAY_MS,
  VERSION_POLL_INTERVAL_MS,
  versionsMismatch,
} from "@/lib/app-version";
import AppVersionActionBlocker from "@/components/AppVersionActionBlocker";
import AppVersionStaleIndicator from "@/components/AppVersionStaleIndicator";
import AppVersionUpdateBanner from "@/components/AppVersionUpdateBanner";

type AppVersionContextValue = {
  currentVersion: string;
  displayVersion: string;
  serverVersion: string | null;
  updateAvailable: boolean;
  checking: boolean;
  checkForUpdate: () => Promise<void>;
  dismissUpdateBanner: () => void;
  reloadApp: () => void;
  guardSensitiveAction: (action?: () => void | Promise<void>) => boolean;
};

const AppVersionContext = createContext<AppVersionContextValue | null>(null);

export function useAppVersion(): AppVersionContextValue {
  const value = useContext(AppVersionContext);
  if (!value) {
    throw new Error("useAppVersion must be used within AppVersionProvider");
  }
  return value;
}

type AppVersionProviderProps = {
  children: ReactNode;
};

export default function AppVersionProvider({ children }: AppVersionProviderProps) {
  const versionCheckEnabled = isVersionCheckEnabled();
  const [serverVersion, setServerVersion] = useState<string | null>(null);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [bannerVisible, setBannerVisible] = useState(false);
  const [checking, setChecking] = useState(false);
  const [actionBlocked, setActionBlocked] = useState(false);

  const checkingRef = useRef(false);
  const mountedRef = useRef(true);

  const displayVersion = useMemo(
    () => formatDisplayVersion(CURRENT_BUILD_VERSION),
    []
  );

  const checkForUpdate = useCallback(async () => {
    if (!versionCheckEnabled || checkingRef.current) return;

    checkingRef.current = true;
    if (mountedRef.current) setChecking(true);

    try {
      const nextServerVersion = await fetchServerVersion();
      if (!mountedRef.current) return;

      if (!nextServerVersion) return;

      setServerVersion(nextServerVersion);

      if (versionsMismatch(CURRENT_BUILD_VERSION, nextServerVersion)) {
        setUpdateAvailable(true);
        setBannerVisible(true);
      }
    } finally {
      checkingRef.current = false;
      if (mountedRef.current) setChecking(false);
    }
  }, [versionCheckEnabled]);

  const dismissUpdateBanner = useCallback(() => {
    setBannerVisible(false);
  }, []);

  const reloadApp = useCallback(() => {
    window.location.reload();
  }, []);

  const guardSensitiveAction = useCallback(
    (action?: () => void | Promise<void>) => {
      if (!updateAvailable) {
        if (action) void action();
        return true;
      }
      setActionBlocked(true);
      return false;
    },
    [updateAvailable]
  );

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!versionCheckEnabled) return;

    const initialTimeout = window.setTimeout(() => {
      void checkForUpdate();
    }, VERSION_INITIAL_CHECK_DELAY_MS);

    const pollInterval = window.setInterval(() => {
      void checkForUpdate();
    }, VERSION_POLL_INTERVAL_MS);

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        void checkForUpdate();
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearTimeout(initialTimeout);
      window.clearInterval(pollInterval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [checkForUpdate, versionCheckEnabled]);

  const value = useMemo<AppVersionContextValue>(
    () => ({
      currentVersion: CURRENT_BUILD_VERSION,
      displayVersion,
      serverVersion,
      updateAvailable,
      checking,
      checkForUpdate,
      dismissUpdateBanner,
      reloadApp,
      guardSensitiveAction,
    }),
    [
      displayVersion,
      serverVersion,
      updateAvailable,
      checking,
      checkForUpdate,
      dismissUpdateBanner,
      reloadApp,
      guardSensitiveAction,
    ]
  );

  return (
    <AppVersionContext.Provider value={value}>
      {children}
      {versionCheckEnabled && updateAvailable && bannerVisible ? (
        <AppVersionUpdateBanner
          onReload={reloadApp}
          onDismiss={dismissUpdateBanner}
        />
      ) : null}
      {versionCheckEnabled && updateAvailable && !bannerVisible ? (
        <AppVersionStaleIndicator onOpen={() => setBannerVisible(true)} />
      ) : null}
      {actionBlocked ? (
        <AppVersionActionBlocker
          onReload={reloadApp}
          onClose={() => setActionBlocked(false)}
        />
      ) : null}
    </AppVersionContext.Provider>
  );
}
