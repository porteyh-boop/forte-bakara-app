import type { NextConfig } from "next";
import { execSync } from "child_process";

const DEVELOPMENT_VERSION = "development";

function resolveBuildVersion(): string {
  if (process.env.NODE_ENV === "development") {
    return DEVELOPMENT_VERSION;
  }

  const vercelSha = process.env.VERCEL_GIT_COMMIT_SHA?.trim();
  if (vercelSha) return vercelSha;

  try {
    const sha = execSync("git rev-parse HEAD", {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    if (sha) return sha;
  } catch {
    // Git unavailable during build — fall through.
  }

  return "";
}

const buildVersion = resolveBuildVersion();

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_APP_BUILD_VERSION: buildVersion || DEVELOPMENT_VERSION,
  },
};

export default nextConfig;
