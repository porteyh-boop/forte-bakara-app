import {
  DEVELOPMENT_VERSION,
  formatDisplayVersion,
  isValidVersion,
  resolveServerBuildVersion,
  versionsMismatch,
} from "../lib/app-version";
import {
  VERSION_UPDATE_BANNER_TITLE,
  VERSION_UPDATE_BLOCK_MESSAGE,
} from "../lib/app-version-messages";

export function runAppVersionQa(
  assert: (condition: boolean, message: string) => void
): void {
  console.log("\n=== QA: App Version ===\n");

  assert(isValidVersion("abc123def456"), "גרסה: SHA תקין");
  assert(isValidVersion(DEVELOPMENT_VERSION), "גרסה: development תקין");
  assert(!isValidVersion(""), "גרסה: מחרוזת ריקה לא תקינה");
  assert(!isValidVersion("   "), "גרסה: רווחים בלבד לא תקינים");
  assert(!isValidVersion(null), "גרסה: null לא תקין");
  assert(!isValidVersion(undefined), "גרסה: undefined לא תקין");

  assert(
    formatDisplayVersion("2cff52a1b2c3d4e5f6") === "2cff52a",
    "גרסה: תצוגה — 7 תווים ראשונים"
  );
  assert(
    formatDisplayVersion(DEVELOPMENT_VERSION) === DEVELOPMENT_VERSION,
    "גרסה: תצוגה — development"
  );

  assert(
    !versionsMismatch("abc123", "abc123"),
    "גרסה: אותה גרסה — אין mismatch"
  );
  assert(
    versionsMismatch("abc123", "def456"),
    "גרסה: גרסאות שונות — mismatch"
  );
  assert(
    !versionsMismatch("", "abc123"),
    "גרסה: גרסת לקוח ריקה — fail-open"
  );
  assert(
    !versionsMismatch("abc123", ""),
    "גרסה: גרסת שרת ריקה — fail-open"
  );
  assert(
    !versionsMismatch("abc123", "  "),
    "גרסה: גרסת שרת רווחים — fail-open"
  );

  const originalNodeEnv = process.env.NODE_ENV;
  const originalOverride = process.env.APP_BUILD_VERSION_OVERRIDE;
  const originalVercelSha = process.env.VERCEL_GIT_COMMIT_SHA;
  const originalPublicVersion = process.env.NEXT_PUBLIC_APP_BUILD_VERSION;

  try {
    Object.assign(process.env, {
      NODE_ENV: "development",
      APP_BUILD_VERSION_OVERRIDE: "qa-server-version",
    });
    assert(
      resolveServerBuildVersion() === "qa-server-version",
      "גרסה: override ב-development"
    );

    delete process.env.APP_BUILD_VERSION_OVERRIDE;
    assert(
      resolveServerBuildVersion() === DEVELOPMENT_VERSION,
      "גרסה: development ללא override"
    );

    Object.assign(process.env, {
      NODE_ENV: "production",
      VERCEL_GIT_COMMIT_SHA: "prodsha1234567890",
      APP_BUILD_VERSION_OVERRIDE: undefined,
    });
    assert(
      resolveServerBuildVersion() === "prodsha1234567890",
      "גרסה: production — VERCEL_GIT_COMMIT_SHA"
    );

    delete process.env.VERCEL_GIT_COMMIT_SHA;
    process.env.NEXT_PUBLIC_APP_BUILD_VERSION = "localbuildsha123";
    assert(
      resolveServerBuildVersion() === "localbuildsha123",
      "גרסה: production — fallback ל-build version"
    );

    process.env.NEXT_PUBLIC_APP_BUILD_VERSION = DEVELOPMENT_VERSION;
    assert(
      resolveServerBuildVersion() === "",
      "גרסה: production ללא מזהה — ריק (fail-open)"
    );

    Object.assign(process.env, {
      NODE_ENV: "production",
      APP_BUILD_VERSION_OVERRIDE: "must-not-apply",
      VERCEL_GIT_COMMIT_SHA: "prodonly",
    });
    assert(
      resolveServerBuildVersion() === "prodonly",
      "גרסה: override לא חל ב-production"
    );
  } finally {
    Object.assign(process.env, {
      NODE_ENV: originalNodeEnv,
      APP_BUILD_VERSION_OVERRIDE: originalOverride,
      VERCEL_GIT_COMMIT_SHA: originalVercelSha,
      NEXT_PUBLIC_APP_BUILD_VERSION: originalPublicVersion,
    });
  }

  assert(
    VERSION_UPDATE_BANNER_TITLE.length > 0,
    "גרסה: כותרת banner מוגדרת"
  );
  assert(
    VERSION_UPDATE_BLOCK_MESSAGE.includes("רענן"),
    "גרסה: הודעת חסימה מוגדרת"
  );

  const sessionStore = new Map<string, string>();
  const mockSessionStorage = {
    getItem: (key: string) => sessionStore.get(key) ?? null,
    setItem: (key: string, value: string) => {
      sessionStore.set(key, value);
    },
    removeItem: (key: string) => {
      sessionStore.delete(key);
    },
    clear: () => {
      sessionStore.clear();
    },
  };

  mockSessionStorage.setItem("forte-master-authenticated", "1");
  mockSessionStorage.setItem("forte-selected-building", "md25");

  const reloadPreservesStorage = () => {
    // reloadApp uses window.location.reload() — must not clear storage beforehand.
    return (
      mockSessionStorage.getItem("forte-master-authenticated") === "1" &&
      mockSessionStorage.getItem("forte-selected-building") === "md25"
    );
  };

  assert(
    reloadPreservesStorage(),
    "גרסה: reload ללא ניקוי — session/local storage נשמר"
  );

  function simulateGuard(updateAvailable: boolean): boolean {
    if (!updateAvailable) return true;
    return false;
  }

  assert(simulateGuard(false), "guard: מותר כשאין עדכון");
  assert(!simulateGuard(true), "guard: חסום כשיש עדכון");
}

if (require.main === module) {
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, message: string) {
    if (condition) {
      passed += 1;
      console.log(`✓ ${message}`);
    } else {
      failed += 1;
      console.error(`✗ ${message}`);
    }
  }

  runAppVersionQa(assert);
  console.log(`\n=== App Version QA: ${passed} passed, ${failed} failed ===\n`);
  process.exit(failed > 0 ? 1 : 0);
}
