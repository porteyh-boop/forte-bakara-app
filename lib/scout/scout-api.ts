import {
  masterApiFetch,
  parseMasterApiError,
  parseMasterApiJson,
} from "@/lib/master-api-fetch";
import type {
  ScoutLeadCandidateDto,
  ScoutSearchPayload,
  ScoutTaskDetailDto,
  ScoutTaskDto,
} from "@/lib/scout/scout-types";

const SCOUT_BASE = "/forte/api/master/ai-marketing/scout";
const QUALIFIER_BASE = "/forte/api/master/ai-marketing/qualifier";

export async function createScoutTask(payload: ScoutSearchPayload): Promise<{
  task: ScoutTaskDto | null;
  error: string | null;
}> {
  const response = await masterApiFetch(`${SCOUT_BASE}/tasks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = await parseMasterApiJson<{ task?: ScoutTaskDto; error?: string }>(
    response
  );
  if (!response.ok || !body?.task) {
    return {
      task: null,
      error: body?.error ?? parseMasterApiError(body, response.status),
    };
  }
  return { task: body.task, error: null };
}

export async function listScoutTasks(): Promise<{
  tasks: ScoutTaskDto[];
  error: string | null;
}> {
  const response = await masterApiFetch(`${SCOUT_BASE}/tasks`, {
    method: "GET",
    cache: "no-store",
  });
  const body = await parseMasterApiJson<{ tasks?: ScoutTaskDto[]; error?: string }>(
    response
  );
  if (!response.ok) {
    return {
      tasks: [],
      error: body?.error ?? parseMasterApiError(body, response.status),
    };
  }
  return { tasks: body?.tasks ?? [], error: null };
}

export async function fetchScoutTaskDetail(taskId: string): Promise<{
  task: ScoutTaskDetailDto | null;
  error: string | null;
}> {
  const response = await masterApiFetch(
    `${SCOUT_BASE}/tasks/${encodeURIComponent(taskId)}`,
    { method: "GET", cache: "no-store" }
  );
  const body = await parseMasterApiJson<{ task?: ScoutTaskDetailDto; error?: string }>(
    response
  );
  if (!response.ok || !body?.task) {
    return {
      task: null,
      error: body?.error ?? parseMasterApiError(body, response.status),
    };
  }
  return { task: body.task, error: null };
}

export async function runScoutTask(taskId: string): Promise<{
  candidatesAdded: number;
  error: string | null;
}> {
  const response = await masterApiFetch(
    `${SCOUT_BASE}/tasks/${encodeURIComponent(taskId)}/run`,
    { method: "POST" }
  );
  const body = await parseMasterApiJson<{
    candidatesAdded?: number;
    error?: string;
  }>(response);
  if (!response.ok) {
    return {
      candidatesAdded: 0,
      error: body?.error ?? parseMasterApiError(body, response.status),
    };
  }
  return { candidatesAdded: body?.candidatesAdded ?? 0, error: null };
}

export async function runQualifierOnCandidate(candidateId: string): Promise<{
  candidate: ScoutLeadCandidateDto | null;
  error: string | null;
}> {
  const response = await masterApiFetch(
    `${QUALIFIER_BASE}/candidates/${encodeURIComponent(candidateId)}/run`,
    { method: "POST" }
  );
  const body = await parseMasterApiJson<{
    candidate?: ScoutLeadCandidateDto;
    error?: string;
  }>(response);
  if (!response.ok || !body?.candidate) {
    return {
      candidate: null,
      error: body?.error ?? parseMasterApiError(body, response.status),
    };
  }
  return { candidate: body.candidate, error: null };
}

export async function patchScoutCandidateReview(input: {
  candidateId: string;
  reviewStatus: "approved" | "rejected";
}): Promise<{ candidate: ScoutLeadCandidateDto | null; error: string | null }> {
  const response = await masterApiFetch(
    `${SCOUT_BASE}/candidates/${encodeURIComponent(input.candidateId)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reviewStatus: input.reviewStatus }),
    }
  );
  const body = await parseMasterApiJson<{
    candidate?: ScoutLeadCandidateDto;
    error?: string;
  }>(response);
  if (!response.ok || !body?.candidate) {
    return {
      candidate: null,
      error: body?.error ?? parseMasterApiError(body, response.status),
    };
  }
  return { candidate: body.candidate, error: null };
}

export async function bulkScoutCandidateReview(input: {
  candidateIds: string[];
  reviewStatus: "approved" | "rejected";
}): Promise<{ updated: number; error: string | null }> {
  const response = await masterApiFetch(`${SCOUT_BASE}/candidates/bulk-review`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const body = await parseMasterApiJson<{ updated?: number; error?: string }>(
    response
  );
  if (!response.ok) {
    return {
      updated: 0,
      error: body?.error ?? parseMasterApiError(body, response.status),
    };
  }
  return { updated: body?.updated ?? 0, error: null };
}

export async function importScoutCandidate(candidateId: string): Promise<{
  candidate: ScoutLeadCandidateDto | null;
  leadId: string | null;
  error: string | null;
}> {
  const response = await masterApiFetch(
    `${SCOUT_BASE}/candidates/${encodeURIComponent(candidateId)}/import`,
    { method: "POST" }
  );
  const body = await parseMasterApiJson<{
    candidate?: ScoutLeadCandidateDto;
    leadId?: string;
    error?: string;
  }>(response);
  if (!response.ok) {
    return {
      candidate: null,
      leadId: null,
      error: body?.error ?? parseMasterApiError(body, response.status),
    };
  }
  return {
    candidate: body?.candidate ?? null,
    leadId: body?.leadId ?? null,
    error: null,
  };
}

export async function bulkImportScoutCandidates(candidateIds: string[]): Promise<{
  imported: number;
  error: string | null;
}> {
  const response = await masterApiFetch(`${SCOUT_BASE}/candidates/bulk-import`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ candidateIds }),
  });
  const body = await parseMasterApiJson<{ imported?: number; error?: string }>(
    response
  );
  if (!response.ok) {
    return {
      imported: 0,
      error: body?.error ?? parseMasterApiError(body, response.status),
    };
  }
  return { imported: body?.imported ?? 0, error: null };
}
