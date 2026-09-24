const DEFAULT_GRAPH_VERSION = "v26.0";
const DEFAULT_SITE = "https://forte-bakara-app.vercel.app";

export const META_FACEBOOK_OAUTH_COOKIE = "forte_meta_oauth_state";
export const META_FACEBOOK_OAUTH_SCOPES = [
  "pages_show_list",
  "pages_manage_posts",
  "pages_read_engagement",
] as const;

export function getMetaGraphApiVersion(): string {
  const raw = process.env.META_GRAPH_API_VERSION?.trim();
  if (!raw) return DEFAULT_GRAPH_VERSION;
  return raw.startsWith("v") ? raw : `v${raw}`;
}

export function getMetaFacebookAppId(): string | null {
  const id = process.env.META_FACEBOOK_APP_ID?.trim();
  return id || null;
}

export function getMetaFacebookAppSecret(): string | null {
  const secret = process.env.META_FACEBOOK_APP_SECRET?.trim();
  return secret || null;
}

export function getPublicSiteUrl(): string {
  const base = process.env.NEXT_PUBLIC_SITE_URL?.trim() || DEFAULT_SITE;
  return base.replace(/\/$/, "");
}

export function getMetaFacebookOAuthRedirectUri(): string {
  return `${getPublicSiteUrl()}/forte/api/master/ai-marketing/marketing/facebook/callback`;
}

export function isMetaFacebookConfigured(): boolean {
  return Boolean(getMetaFacebookAppId() && getMetaFacebookAppSecret());
}

export function metaGraphBaseUrl(): string {
  return `https://graph.facebook.com/${getMetaGraphApiVersion()}`;
}

export function metaFacebookDialogOAuthUrl(input: {
  state: string;
  redirectUri: string;
}): string {
  const appId = getMetaFacebookAppId();
  if (!appId) throw new Error("meta_app_not_configured");
  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: input.redirectUri,
    state: input.state,
    response_type: "code",
    scope: META_FACEBOOK_OAUTH_SCOPES.join(","),
  });
  return `https://www.facebook.com/${getMetaGraphApiVersion()}/dialog/oauth?${params.toString()}`;
}

export function buildFacebookPostPermalink(facebookPostId: string): string {
  const id = facebookPostId.trim();
  if (!id) return "";
  if (id.includes("_")) {
    const [pageId, storyId] = id.split("_", 2);
    return `https://www.facebook.com/${encodeURIComponent(pageId)}/posts/${encodeURIComponent(storyId)}`;
  }
  return `https://www.facebook.com/photo/?fbid=${encodeURIComponent(id)}`;
}
