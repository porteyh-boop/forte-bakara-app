import type { ProjectV2TabId } from "@/lib/master-project-v2-routes";

export type ProjectV2NavTab = ProjectV2TabId | "details";

const STORAGE_KEY = "forte-project-v2-nav-stack";
const MAX_STACK_DEPTH = 30;

type NavStackState = Record<string, ProjectV2NavTab[]>;

function readStackState(): NavStackState {
  if (typeof window === "undefined") return {};
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as NavStackState;
  } catch {
    return {};
  }
}

function writeStackState(state: NavStackState): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore quota / private mode
  }
}

export function pushProjectV2NavTab(
  buildingId: string,
  tab: ProjectV2NavTab
): void {
  const key = buildingId.trim().toLowerCase();
  if (!key) return;

  const state = readStackState();
  const stack = state[key] ?? [];
  if (stack[stack.length - 1] === tab) return;

  stack.push(tab);
  state[key] = stack.slice(-MAX_STACK_DEPTH);
  writeStackState(state);
}

export function popProjectV2NavTab(
  buildingId: string
): ProjectV2NavTab | null {
  const key = buildingId.trim().toLowerCase();
  if (!key) return null;

  const state = readStackState();
  const stack = state[key] ?? [];
  if (stack.length === 0) return null;

  const tab = stack.pop() ?? null;
  if (stack.length === 0) {
    delete state[key];
  } else {
    state[key] = stack;
  }
  writeStackState(state);
  return tab;
}

export function clearProjectV2NavStack(buildingId: string): void {
  const key = buildingId.trim().toLowerCase();
  if (!key) return;

  const state = readStackState();
  if (!(key in state)) return;
  delete state[key];
  writeStackState(state);
}
