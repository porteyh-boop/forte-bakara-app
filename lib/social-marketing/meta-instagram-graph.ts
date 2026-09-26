import { metaGraphBaseUrl } from "@/lib/social-marketing/meta-facebook-config";
import { MetaGraphApiError, type MetaGraphFetch } from "@/lib/social-marketing/meta-facebook-graph";

async function readJson(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

export type InstagramBusinessAccount = {
  id: string;
  username: string | null;
};

export async function fetchInstagramBusinessAccountForPage(input: {
  pageId: string;
  pageAccessToken: string;
  fetchImpl?: MetaGraphFetch;
}): Promise<InstagramBusinessAccount | null> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const params = new URLSearchParams({
    fields: "instagram_business_account{id,username}",
    access_token: input.pageAccessToken,
  });
  const res = await fetchImpl(
    `${metaGraphBaseUrl()}/${encodeURIComponent(input.pageId)}?${params.toString()}`
  );
  const body = (await readJson(res)) as {
    instagram_business_account?: { id?: string; username?: string };
    error?: { message?: string; code?: number };
  };
  if (!res.ok) {
    throw new MetaGraphApiError(body.error?.message ?? "instagram_account_lookup_failed", body.error?.code ?? null);
  }
  const ig = body.instagram_business_account;
  const id = ig?.id?.trim();
  if (!id) return null;
  return {
    id,
    username: ig?.username?.trim() || null,
  };
}

export async function createInstagramMediaContainer(input: {
  igUserId: string;
  pageAccessToken: string;
  imageUrl: string;
  caption: string;
  fetchImpl?: MetaGraphFetch;
  signal?: AbortSignal;
}): Promise<{ containerId: string }> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const url = `${metaGraphBaseUrl()}/${encodeURIComponent(input.igUserId)}/media`;
  const res = await fetchImpl(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      image_url: input.imageUrl.trim(),
      caption: input.caption.trim(),
      access_token: input.pageAccessToken,
    }),
    signal: input.signal,
  });
  const body = (await readJson(res)) as { id?: string; error?: { message?: string; code?: number } };
  const containerId = body.id?.trim();
  if (!res.ok || !containerId) {
    throw new MetaGraphApiError(body.error?.message ?? "instagram_media_create_failed", body.error?.code ?? null);
  }
  return { containerId };
}

export async function getInstagramContainerStatusCode(input: {
  containerId: string;
  pageAccessToken: string;
  fetchImpl?: MetaGraphFetch;
  signal?: AbortSignal;
}): Promise<string> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const params = new URLSearchParams({
    fields: "status_code",
    access_token: input.pageAccessToken,
  });
  const res = await fetchImpl(
    `${metaGraphBaseUrl()}/${encodeURIComponent(input.containerId)}?${params.toString()}`,
    { signal: input.signal }
  );
  const body = (await readJson(res)) as {
    status_code?: string;
    error?: { message?: string; code?: number };
  };
  if (!res.ok) {
    throw new MetaGraphApiError(body.error?.message ?? "instagram_container_status_failed", body.error?.code ?? null);
  }
  return asString(body.status_code);
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

export async function waitForInstagramContainerReady(input: {
  containerId: string;
  pageAccessToken: string;
  fetchImpl?: MetaGraphFetch;
  signal?: AbortSignal;
  maxAttempts?: number;
  delayMs?: number;
}): Promise<void> {
  const maxAttempts = input.maxAttempts ?? 12;
  const delayMs = input.delayMs ?? 2000;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const code = await getInstagramContainerStatusCode(input);
    if (code === "FINISHED") return;
    if (code === "ERROR" || code === "EXPIRED") {
      throw new MetaGraphApiError(`instagram_container_${code.toLowerCase()}`);
    }
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  throw new MetaGraphApiError("instagram_container_timeout");
}

export async function publishInstagramMediaContainer(input: {
  igUserId: string;
  pageAccessToken: string;
  creationId: string;
  fetchImpl?: MetaGraphFetch;
  signal?: AbortSignal;
}): Promise<{ mediaId: string }> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const url = `${metaGraphBaseUrl()}/${encodeURIComponent(input.igUserId)}/media_publish`;
  const res = await fetchImpl(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      creation_id: input.creationId.trim(),
      access_token: input.pageAccessToken,
    }),
    signal: input.signal,
  });
  const body = (await readJson(res)) as { id?: string; error?: { message?: string; code?: number } };
  const mediaId = body.id?.trim();
  if (!res.ok || !mediaId) {
    throw new MetaGraphApiError(body.error?.message ?? "instagram_media_publish_failed", body.error?.code ?? null);
  }
  return { mediaId };
}

export async function fetchInstagramMediaPermalink(input: {
  mediaId: string;
  pageAccessToken: string;
  fetchImpl?: MetaGraphFetch;
}): Promise<string | null> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const params = new URLSearchParams({
    fields: "permalink",
    access_token: input.pageAccessToken,
  });
  const res = await fetchImpl(
    `${metaGraphBaseUrl()}/${encodeURIComponent(input.mediaId)}?${params.toString()}`
  );
  const body = (await readJson(res)) as { permalink?: string; error?: { message?: string; code?: number } };
  if (!res.ok) return null;
  const link = body.permalink?.trim();
  return link || null;
}
