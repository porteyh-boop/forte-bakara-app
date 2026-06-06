import { APP_ROLE } from "./config";
import type { UserRole } from "./types";

export function getRole(): UserRole {
  return APP_ROLE;
}

export function isExpert(): boolean {
  return APP_ROLE === "expert";
}

export function isClient(): boolean {
  return APP_ROLE === "client";
}
