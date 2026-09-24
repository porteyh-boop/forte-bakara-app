import { metaGraphBaseUrl } from "@/lib/social-marketing/meta-facebook-config";

export type MetaGraphFetch = typeof fetch;

export type MetaGraphErrorBody = {
  error?: { message?: string; type?: string; code?: number };
};

export class MetaGraphApiError extends Error {
  code: number | null;
  constructor(message: string, code: number | null = null) {
    super(message);
    this.code = code;
  }
}

async function readJson(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

export async function exchangeCodeForUserAccessToken(input: {
  code: string;
  redirectUri: string;
  fetchImpl?: MetaGraphFetch;
}): Promise<{ accessToken: string; expiresIn: number | null }> {
  const appId = process.env.META_FACEBOOK_APP_ID?.trim();
  const appSecret = process.env.META_FACEBOOK_APP_SECRET?.trim();
  if (!appId || !appSecret) throw new MetaGraphApiError("meta_app_not_configured");

  const params = new URLSearchParams({
    client_id: appId,
    client_secret: appSecret,
    redirect_uri: input.redirectUri,
    code: input.code,
  });
  const fetchImpl = input.fetchImpl ?? fetch;
  const res = await fetchImpl(`${metaGraphBaseUrl()}/oauth/access_token?${params.toString()}`);
  const body = (await readJson(res)) as {
    access_token?: string;
    expires_in?: number;
    error?: MetaGraphErrorBody["error"];
  };
  if (!res.ok || !body.access_token) {
    throw new MetaGraphApiError(body.error?.message ?? "token_exchange_failed", body.error?.code ?? null);
  }
  return {
    accessToken: body.access_token,
    expiresIn: typeof body.expires_in === "number" ? body.expires_in : null,
  };
}

export async function exchangeForLongLivedUserToken(input: {
  shortLivedToken: string;
  fetchImpl?: MetaGraphFetch;
}): Promise<{ accessToken: string; expiresIn: number | null }> {
  const appId = process.env.META_FACEBOOK_APP_ID?.trim();
  const appSecret = process.env.META_FACEBOOK_APP_SECRET?.trim();
  if (!appId || !appSecret) throw new MetaGraphApiError("meta_app_not_configured");

  const params = new URLSearchParams({
    grant_type: "fb_exchange_token",
    client_id: appId,
    client_secret: appSecret,
    fb_exchange_token: input.shortLivedToken,
  });
  const fetchImpl = input.fetchImpl ?? fetch;
  const res = await fetchImpl(`${metaGraphBaseUrl()}/oauth/access_token?${params.toString()}`);
  const body = (await readJson(res)) as {
    access_token?: string;
    expires_in?: number;
    error?: MetaGraphErrorBody["error"];
  };
  if (!res.ok || !body.access_token) {
    throw new MetaGraphApiError(body.error?.message ?? "long_lived_exchange_failed", body.error?.code ?? null);
  }
  return {
    accessToken: body.access_token,
    expiresIn: typeof body.expires_in === "number" ? body.expires_in : null,
  };
}

export type FacebookManagedPage = {
  id: string;
  name: string;
  accessToken: string;
  tasks: string[];
};

export async function listManagedFacebookPages(input: {
  userAccessToken: string;
  fetchImpl?: MetaGraphFetch;
}): Promise<FacebookManagedPage[]> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const params = new URLSearchParams({
    fields: "id,name,access_token,tasks",
    access_token: input.userAccessToken,
  });
  const res = await fetchImpl(`${metaGraphBaseUrl()}/me/accounts?${params.toString()}`);
  const body = (await readJson(res)) as {
    data?: Array<{
      id?: string;
      name?: string;
      access_token?: string;
      tasks?: string[];
    }>;
    error?: MetaGraphErrorBody["error"];
  };
  if (!res.ok) {
    throw new MetaGraphApiError(body.error?.message ?? "pages_list_failed", body.error?.code ?? null);
  }
  return (body.data ?? [])
    .filter((p) => p.id && p.access_token)
    .map((p) => ({
      id: String(p.id),
      name: String(p.name ?? ""),
      accessToken: String(p.access_token),
      tasks: Array.isArray(p.tasks) ? p.tasks.map(String) : [],
    }));
}

export async function publishPageFeedPost(input: {
  pageId: string;
  pageAccessToken: string;
  message: string;
  fetchImpl?: MetaGraphFetch;
  signal?: AbortSignal;
}): Promise<{ id: string }> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const url = `${metaGraphBaseUrl()}/${encodeURIComponent(input.pageId)}/feed`;
  const res = await fetchImpl(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: input.message,
      published: true,
      access_token: input.pageAccessToken,
    }),
    signal: input.signal,
  });
  const body = (await readJson(res)) as { id?: string; error?: MetaGraphErrorBody["error"] };
  if (!res.ok || !body.id) {
    throw new MetaGraphApiError(body.error?.message ?? "publish_failed", body.error?.code ?? null);
  }
  return { id: body.id };
}

export function facebookGraphPostIdFromPhotoCreateResponse(body: {
  id?: string;
  post_id?: string;
}): string {
  const postId = typeof body.post_id === "string" ? body.post_id.trim() : "";
  if (postId) return postId;
  const photoId = typeof body.id === "string" ? body.id.trim() : "";
  return photoId;
}

export async function publishPagePhotoPost(input: {
  pageId: string;
  pageAccessToken: string;
  imageUrl: string;
  caption: string;
  fetchImpl?: MetaGraphFetch;
  signal?: AbortSignal;
}): Promise<{ graphPostId: string; photoId: string | null; postId: string | null }> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const url = `${metaGraphBaseUrl()}/${encodeURIComponent(input.pageId)}/photos`;
  const res = await fetchImpl(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: input.imageUrl.trim(),
      caption: input.caption.trim(),
      published: true,
      access_token: input.pageAccessToken,
    }),
    signal: input.signal,
  });
  const body = (await readJson(res)) as {
    id?: string;
    post_id?: string;
    error?: MetaGraphErrorBody["error"];
  };
  const graphPostId = facebookGraphPostIdFromPhotoCreateResponse(body);
  if (!res.ok || !graphPostId) {
    throw new MetaGraphApiError(body.error?.message ?? "photo_publish_failed", body.error?.code ?? null);
  }
  return {
    graphPostId,
    photoId: body.id?.trim() || null,
    postId: body.post_id?.trim() || null,
  };
}

export async function debugToken(input: {
  inputToken: string;
  fetchImpl?: MetaGraphFetch;
}): Promise<{ isValid: boolean; expiresAt: number | null }> {
  const appId = process.env.META_FACEBOOK_APP_ID?.trim();
  const appSecret = process.env.META_FACEBOOK_APP_SECRET?.trim();
  if (!appId || !appSecret) throw new MetaGraphApiError("meta_app_not_configured");
  const appToken = `${appId}|${appSecret}`;
  const fetchImpl = input.fetchImpl ?? fetch;
  const params = new URLSearchParams({
    input_token: input.inputToken,
    access_token: appToken,
  });
  const res = await fetchImpl(`${metaGraphBaseUrl()}/debug_token?${params.toString()}`);
  const body = (await readJson(res)) as {
    data?: { is_valid?: boolean; expires_at?: number };
    error?: MetaGraphErrorBody["error"];
  };
  if (!res.ok) {
    throw new MetaGraphApiError(body.error?.message ?? "debug_token_failed", body.error?.code ?? null);
  }
  return {
    isValid: body.data?.is_valid === true,
    expiresAt: typeof body.data?.expires_at === "number" ? body.data.expires_at : null,
  };
}
