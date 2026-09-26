"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  ForteV2DangerButton,
  ForteV2Dialog,
  ForteV2DialogOverlay,
  ForteV2EmptyState,
  ForteV2FormInput,
  ForteV2FormLabel,
  ForteV2PrimaryButton,
  ForteV2SecondaryButton,
  ForteV2StatusBadge,
  ForteV2StatusBanner,
  ForteV2TableCard,
} from "@/components/master-v2/project-v2/MasterProjectV2Workspace";
import {
  createSocialMarketingPost,
  deleteSocialMarketingPost,
  duplicateSocialMarketingPost,
  generateSocialMarketingPostsWithAi,
  listSocialMarketingPosts,
  runSocialMarketingPostAction,
  updateSocialMarketingPost,
} from "@/lib/social-marketing/social-marketing-api";
import type { FacebookConnectionStatusDto } from "@/lib/social-marketing/meta-facebook-server";
import {
  disconnectFacebookPage,
  fetchFacebookConnectionStatus,
  listFacebookPagesForSelection,
  selectFacebookPage,
  startFacebookConnectUrl,
} from "@/lib/social-marketing/meta-facebook-api";
import { SocialPostPublishStatusPanel } from "@/components/master-v2/SocialPostPublishStatusPanel";
import {
  canPublishToFacebookNetwork,
  canPublishToInstagramNetwork,
  targetsFacebook,
  targetsInstagram,
} from "@/lib/social-marketing/social-marketing-publish-status";
import {
  SOCIAL_PLATFORMS,
  SOCIAL_PLATFORM_LABELS,
  SOCIAL_POST_STATUS_LABELS,
  type SocialMarketingPostDto,
  type SocialMarketingPostInput,
  type SocialPlatformId,
} from "@/lib/social-marketing/social-marketing-types";

const emptyInput = (): SocialMarketingPostInput => ({
  topic: "",
  targetAudience: "",
  platform: "both",
  bodyFacebook: "",
  bodyInstagram: "",
  publishDate: "",
  publishTime: "",
  imageUrl: "",
});

function postToInput(post: SocialMarketingPostDto): SocialMarketingPostInput {
  return {
    topic: post.topic,
    targetAudience: post.targetAudience,
    platform: post.platform,
    bodyFacebook: post.bodyFacebook,
    bodyInstagram: post.bodyInstagram,
    publishDate: post.publishDate ?? "",
    publishTime: post.publishTime ?? "",
    imageUrl: post.imageUrl ?? "",
  };
}

function statusTone(
  status: SocialMarketingPostDto["status"]
): "success" | "warning" | "danger" | "neutral" | "blue" {
  if (status === "approved" || status === "ready_to_publish" || status === "published") {
    return "success";
  }
  if (status === "pending_approval" || status === "scheduled") return "warning";
  if (status === "failed" || status === "rejected") return "danger";
  if (status === "publish_uncertain") return "warning";
  return "neutral";
}

function canPublishToFacebook(
  post: SocialMarketingPostDto,
  fb: FacebookConnectionStatusDto | null
): boolean {
  if (!fb?.connected || fb.tokenValid === false) return false;
  return canPublishToFacebookNetwork(post);
}

function canPublishToInstagram(
  post: SocialMarketingPostDto,
  fb: FacebookConnectionStatusDto | null
): boolean {
  if (!fb?.connected || fb.tokenValid === false || !fb.instagramConnected) return false;
  return canPublishToInstagramNetwork(post);
}

function canPublishBoth(
  post: SocialMarketingPostDto,
  fb: FacebookConnectionStatusDto | null
): boolean {
  const fbReady = targetsFacebook(post.platform) && canPublishToFacebook(post, fb);
  const igReady = targetsInstagram(post.platform) && canPublishToInstagram(post, fb);
  return fbReady && igReady;
}

function facebookPublishButtonLabel(post: SocialMarketingPostDto): string {
  if (post.facebookPublishStatus === "failed" || post.publishErrorCode) {
    return "נסה שוב — פייסבוק";
  }
  return "פרסם בפייסבוק";
}

function instagramPublishButtonLabel(post: SocialMarketingPostDto): string {
  if (post.instagramPublishStatus === "failed" || post.instagramPublishError) {
    return "נסה שוב — אינסטגרם";
  }
  return "פרסם באינסטגרם";
}

function MarketingPostImage({
  url,
  className,
}: {
  url: string;
  className?: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt=""
      loading="lazy"
      className={
        className ??
        "w-full max-h-72 rounded-xl object-cover border border-forte-border/60 bg-forte-background/40"
      }
    />
  );
}

function PostPreview({ post }: { post: SocialMarketingPostDto }) {
  const showFb = post.platform === "facebook" || post.platform === "both";
  const showIg = post.platform === "instagram" || post.platform === "both";
  return (
    <div className="space-y-3">
      {post.imageUrl ? (
        <MarketingPostImage url={post.imageUrl} />
      ) : (
        <div className="h-24 rounded-xl border border-dashed border-forte-border flex items-center justify-center text-xs text-forte-text-secondary">
          מקום לתמונה
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {showFb ? (
        <div className="rounded-xl border border-forte-border bg-white p-3 shadow-sm">
          <p className="text-xs font-semibold text-forte-text-secondary mb-2">Facebook</p>
          <p className="text-sm font-semibold text-forte-text">{post.topic}</p>
          <p className="text-sm text-forte-text/90 mt-2 whitespace-pre-wrap">
            {post.bodyFacebook || "—"}
          </p>
        </div>
      ) : null}
      {showIg ? (
        <div className="rounded-xl border border-forte-border bg-white p-3 shadow-sm">
          <p className="text-xs font-semibold text-forte-text-secondary mb-2">Instagram</p>
          <p className="text-sm font-semibold text-forte-text">{post.topic}</p>
          <p className="text-sm text-forte-text/90 mt-2 whitespace-pre-wrap">
            {post.bodyInstagram || "—"}
          </p>
        </div>
      ) : null}
      {post.visualPrompt ? (
        <div className="sm:col-span-2 rounded-lg border border-dashed border-forte-border bg-forte-background/40 p-3">
          <p className="text-xs font-semibold text-forte-text-secondary mb-1">רעיון לתמונה (AI)</p>
          <p className="text-sm text-forte-text whitespace-pre-wrap">{post.visualPrompt}</p>
        </div>
      ) : null}
      </div>
    </div>
  );
}

export default function MasterForteAiMarketingSection() {
  const searchParams = useSearchParams();
  const [posts, setPosts] = useState<SocialMarketingPostDto[]>([]);
  const [fbStatus, setFbStatus] = useState<FacebookConnectionStatusDto | null>(null);
  const [pagePickerOpen, setPagePickerOpen] = useState(false);
  const [pageOptions, setPageOptions] = useState<{ id: string; name: string; canCreateContent: boolean }[]>(
    []
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<SocialMarketingPostDto | null>(null);
  const [form, setForm] = useState<SocialMarketingPostInput>(emptyInput());
  const [formError, setFormError] = useState<string | null>(null);
  const [previewPost, setPreviewPost] = useState<SocialMarketingPostDto | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SocialMarketingPostDto | null>(null);
  const [aiGenerating, setAiGenerating] = useState(false);

  const refreshFb = useCallback(async () => {
    const result = await fetchFacebookConnectionStatus();
    setFbStatus(result.status);
    if (result.error) setError(result.error);
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    const postsResult = await listSocialMarketingPosts();
    await refreshFb();
    setPosts(postsResult.posts);
    if (postsResult.error) setError(postsResult.error);
    setLoading(false);
  }, [refreshFb]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const fb = searchParams.get("facebook");
    if (fb === "select-page") {
      void (async () => {
        const pages = await listFacebookPagesForSelection();
        if (pages.error) {
          setError(pages.error);
          return;
        }
        setPageOptions(pages.pages);
        setPagePickerOpen(true);
      })();
    }
    if (fb === "error") {
      setError("החיבור לפייסבוק לא הושלם. נסו שוב.");
    }
  }, [searchParams]);

  const showFacebook = form.platform === "facebook" || form.platform === "both";
  const showInstagram = form.platform === "instagram" || form.platform === "both";

  const previewFromForm = useMemo((): SocialMarketingPostDto | null => {
    if (!form.topic.trim()) return null;
    return {
      id: editing?.id ?? "preview",
      topic: form.topic,
      targetAudience: form.targetAudience,
      platform: form.platform,
      bodyFacebook: form.bodyFacebook,
      bodyInstagram: form.bodyInstagram,
      publishDate: form.publishDate || null,
      publishTime: form.publishTime || null,
      imageUrl: form.imageUrl || null,
      visualPrompt: editing?.visualPrompt ?? null,
      generatedBy: editing?.generatedBy ?? null,
      status: editing?.status ?? "draft",
      approvedAt: editing?.approvedAt ?? null,
      approvedBy: editing?.approvedBy ?? null,
      contentVersion: editing?.contentVersion ?? 1,
      approvedContentVersion: editing?.approvedContentVersion ?? null,
      facebookPostId: editing?.facebookPostId ?? null,
      facebookPostUrl: editing?.facebookPostUrl ?? null,
      publishedToFacebookAt: editing?.publishedToFacebookAt ?? null,
      publishErrorCode: editing?.publishErrorCode ?? null,
      publishErrorMessage: editing?.publishErrorMessage ?? null,
      facebookPublishStatus: editing?.facebookPublishStatus ?? null,
      instagramPublishStatus: editing?.instagramPublishStatus ?? null,
      instagramMediaId: editing?.instagramMediaId ?? null,
      instagramPermalink: editing?.instagramPermalink ?? null,
      instagramPublishedAt: editing?.instagramPublishedAt ?? null,
      instagramPublishError: editing?.instagramPublishError ?? null,
      createdAt: editing?.createdAt ?? "",
      updatedAt: editing?.updatedAt ?? "",
    };
  }, [form, editing]);

  function openCreate() {
    setEditing(null);
    setForm(emptyInput());
    setFormError(null);
    setEditorOpen(true);
  }

  function openEdit(post: SocialMarketingPostDto) {
    setEditing(post);
    setForm(postToInput(post));
    setFormError(null);
    setEditorOpen(true);
  }

  function upsertLocal(post: SocialMarketingPostDto) {
    setPosts((current) => {
      const i = current.findIndex((p) => p.id === post.id);
      if (i === -1) return [post, ...current];
      const copy = [...current];
      copy[i] = post;
      return copy;
    });
  }

  async function saveDraft() {
    if (busy) return;
    setBusy(true);
    setFormError(null);
    const result = editing
      ? await updateSocialMarketingPost(editing.id, form)
      : await createSocialMarketingPost(form);
    setBusy(false);
    if (result.error || !result.post) {
      setFormError(result.error ?? "השמירה נכשלה.");
      return;
    }
    upsertLocal(result.post);
    setEditing(result.post);
    setEditorOpen(false);
  }

  async function runAction(post: SocialMarketingPostDto, action: Parameters<typeof runSocialMarketingPostAction>[1]) {
    if (busy) return;
    setBusy(true);
    const result = await runSocialMarketingPostAction(post.id, action);
    setBusy(false);
    if (result.error || !result.post) {
      setError(result.error);
      return;
    }
    upsertLocal(result.post);
    setPreviewPost(null);
  }

  async function confirmDelete() {
    if (!deleteTarget || busy) return;
    setBusy(true);
    const result = await deleteSocialMarketingPost(deleteTarget.id);
    setBusy(false);
    if (!result.deleted) {
      setError(result.error);
      return;
    }
    setPosts((current) => current.filter((p) => p.id !== deleteTarget.id));
    setDeleteTarget(null);
  }

  async function handleDuplicate(post: SocialMarketingPostDto) {
    if (busy) return;
    setBusy(true);
    const result = await duplicateSocialMarketingPost(post.id);
    setBusy(false);
    if (result.error || !result.post) {
      setError(result.error);
      return;
    }
    setPosts((current) => [result.post!, ...current]);
  }

  function connectFacebook() {
    window.location.assign(startFacebookConnectUrl());
  }

  async function handleGenerateWithAi() {
    if (busy || aiGenerating) return;
    setAiGenerating(true);
    setError(null);
    const result = await generateSocialMarketingPostsWithAi();
    setAiGenerating(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    await refresh();
  }

  async function confirmPageSelection(pageId: string) {
    if (busy) return;
    setBusy(true);
    const result = await selectFacebookPage(pageId);
    setBusy(false);
    if (result.error || !result.status) {
      setError(result.error);
      return;
    }
    setFbStatus(result.status);
    setPagePickerOpen(false);
  }

  return (
    <ForteV2TableCard title="שיווק — רשתות חברתיות">
      <div className="rounded-xl border border-forte-border bg-forte-background/50 p-3 mb-4 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-forte-text">חיבור פייסבוק</p>
            <p className="text-xs text-forte-text-secondary mt-1">
              {fbStatus?.connected
                ? `מחובר לדף: ${fbStatus.pageName} (מזהה ${fbStatus.pageId})${
                    fbStatus.instagramConnected
                      ? ` · Instagram: @${fbStatus.instagramUsername ?? fbStatus.instagramBusinessAccountId}`
                      : " · Instagram: לא זוהה — בדקו קישור ב-Meta"
                  }`
                : "לא מחובר לדף עסקי"}
              {fbStatus?.connected && fbStatus.tokenValid === false
                ? " · יש להתחבר מחדש"
                : fbStatus?.connected && fbStatus.tokenValid
                  ? " · חיבור תקין"
                  : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <ForteV2SecondaryButton onClick={() => void connectFacebook()}>
              חיבור לפייסבוק
            </ForteV2SecondaryButton>
            {fbStatus?.connected ? (
              <ForteV2SecondaryButton
                disabled={busy}
                onClick={() => void disconnectFacebookPage().then(() => refreshFb())}
              >
                ניתוק
              </ForteV2SecondaryButton>
            ) : null}
            <ForteV2SecondaryButton
              disabled={busy || aiGenerating}
              onClick={() => void handleGenerateWithAi()}
            >
              {aiGenerating ? "יוצר תוכן ותמונות..." : "צור פוסטים עם AI"}
            </ForteV2SecondaryButton>
            <ForteV2PrimaryButton onClick={openCreate}>פוסט חדש</ForteV2PrimaryButton>
          </div>
        </div>
        <p className="text-xs text-forte-text-secondary">
          יצירת AI שומרת 3 הצעות עם תמונה במצב ממתין לאישור. אישור ודחייה — בלבד מ«אישורים הממתינים ליהודה» למטה.
          פרסום לפייסבוק/אינסטגרם דורש חיבור Meta תקין + אישור יהודה. לאינסטגרם חובה תמונה.
        </p>
      </div>

      {error ? <ForteV2StatusBanner tone="error">{error}</ForteV2StatusBanner> : null}

      {loading ? (
        <p className="text-sm text-forte-text-secondary py-6 text-center">טוען פוסטים...</p>
      ) : posts.length === 0 ? (
        <ForteV2EmptyState
          title="אין פוסטים"
          description="צרו פוסט חדש כדי להתחיל."
          actions={<ForteV2PrimaryButton onClick={openCreate}>פוסט חדש</ForteV2PrimaryButton>}
        />
      ) : (
        <ul className="divide-y divide-forte-border/60">
          {posts.map((post) => (
            <li key={post.id} className="py-4 flex flex-col lg:flex-row lg:items-start gap-3">
              {post.imageUrl ? (
                <MarketingPostImage
                  url={post.imageUrl}
                  className="w-full lg:w-20 lg:h-20 h-36 shrink-0 rounded-lg object-cover border border-forte-border/60"
                />
              ) : null}
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-forte-text">{post.topic}</p>
                  <ForteV2StatusBadge tone={statusTone(post.status)}>
                    {SOCIAL_POST_STATUS_LABELS[post.status]}
                  </ForteV2StatusBadge>
                </div>
                <p className="text-xs text-forte-text-secondary mt-1">
                  {SOCIAL_PLATFORM_LABELS[post.platform]}
                  {post.targetAudience ? ` · ${post.targetAudience}` : ""}
                  {post.publishDate
                    ? ` · ${post.publishDate}${post.publishTime ? ` ${post.publishTime}` : ""}`
                    : ""}
                </p>
                <SocialPostPublishStatusPanel
                  post={post}
                  retryDisabled={busy}
                  onRetryFacebook={
                    canPublishToFacebook(post, fbStatus)
                      ? () => void runAction(post, "publish_facebook")
                      : undefined
                  }
                  onRetryInstagram={
                    canPublishToInstagram(post, fbStatus)
                      ? () => void runAction(post, "publish_instagram")
                      : undefined
                  }
                />
              </div>
              <div className="flex flex-wrap gap-2 shrink-0">
                <ForteV2SecondaryButton disabled={busy} onClick={() => openEdit(post)}>
                  ערוך
                </ForteV2SecondaryButton>
                {post.status === "draft" || post.status === "rejected" ? (
                  <ForteV2SecondaryButton
                    disabled={busy}
                    onClick={() => void runAction(post, "submit_for_approval")}
                  >
                    העבר לאישור
                  </ForteV2SecondaryButton>
                ) : null}
                {post.status === "pending_approval" ? (
                  <ForteV2SecondaryButton disabled={busy} onClick={() => setPreviewPost(post)}>
                    תצוגה מקדימה
                  </ForteV2SecondaryButton>
                ) : null}
                {post.status === "approved" ? (
                  <ForteV2PrimaryButton
                    disabled={busy}
                    onClick={() => void runAction(post, "schedule")}
                  >
                    תזמן
                  </ForteV2PrimaryButton>
                ) : null}
                {post.status === "scheduled" ? (
                  <ForteV2PrimaryButton
                    disabled={busy}
                    onClick={() => void runAction(post, "mark_ready_to_publish")}
                  >
                    מוכן לפרסום
                  </ForteV2PrimaryButton>
                ) : null}
                {canPublishToFacebook(post, fbStatus) ? (
                  <ForteV2PrimaryButton
                    disabled={busy}
                    onClick={() => void runAction(post, "publish_facebook")}
                  >
                    {facebookPublishButtonLabel(post)}
                  </ForteV2PrimaryButton>
                ) : null}
                {canPublishToInstagram(post, fbStatus) ? (
                  <ForteV2PrimaryButton
                    disabled={busy}
                    onClick={() => void runAction(post, "publish_instagram")}
                  >
                    {instagramPublishButtonLabel(post)}
                  </ForteV2PrimaryButton>
                ) : null}
                {canPublishBoth(post, fbStatus) ? (
                  <ForteV2PrimaryButton
                    disabled={busy}
                    onClick={() => void runAction(post, "publish_both")}
                  >
                    פרסם בשניהם
                  </ForteV2PrimaryButton>
                ) : null}
                <ForteV2SecondaryButton disabled={busy} onClick={() => void handleDuplicate(post)}>
                  שכפל
                </ForteV2SecondaryButton>
                <ForteV2DangerButton disabled={busy} onClick={() => setDeleteTarget(post)}>
                  מחק
                </ForteV2DangerButton>
              </div>
            </li>
          ))}
        </ul>
      )}

      {editorOpen ? (
        <ForteV2DialogOverlay onClose={() => !busy && setEditorOpen(false)}>
          <ForteV2Dialog
            title={editing ? "עריכת פוסט" : "פוסט חדש"}
            onClose={() => !busy && setEditorOpen(false)}
            size="xl"
          >
            <div className="space-y-4 text-sm">
              {formError ? <ForteV2StatusBanner tone="error">{formError}</ForteV2StatusBanner> : null}
              <label className="block space-y-1">
                <ForteV2FormLabel>נושא</ForteV2FormLabel>
                <ForteV2FormInput
                  value={form.topic}
                  onChange={(e) => setForm((f) => ({ ...f, topic: e.target.value }))}
                />
              </label>
              <label className="block space-y-1">
                <ForteV2FormLabel>קהל יעד</ForteV2FormLabel>
                <ForteV2FormInput
                  value={form.targetAudience}
                  onChange={(e) => setForm((f) => ({ ...f, targetAudience: e.target.value }))}
                />
              </label>
              <label className="block space-y-1">
                <ForteV2FormLabel>פלטפורמה</ForteV2FormLabel>
                <select
                  className="fv2-input w-full"
                  value={form.platform}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      platform: e.target.value as SocialPlatformId,
                    }))
                  }
                >
                  {SOCIAL_PLATFORMS.map((p) => (
                    <option key={p} value={p}>
                      {SOCIAL_PLATFORM_LABELS[p]}
                    </option>
                  ))}
                </select>
              </label>
              {showFacebook ? (
                <label className="block space-y-1">
                  <ForteV2FormLabel>תוכן Facebook</ForteV2FormLabel>
                  <textarea
                    className="fv2-input w-full min-h-[88px]"
                    value={form.bodyFacebook}
                    onChange={(e) => setForm((f) => ({ ...f, bodyFacebook: e.target.value }))}
                  />
                </label>
              ) : null}
              {showInstagram ? (
                <label className="block space-y-1">
                  <ForteV2FormLabel>תוכן Instagram</ForteV2FormLabel>
                  <textarea
                    className="fv2-input w-full min-h-[88px]"
                    value={form.bodyInstagram}
                    onChange={(e) => setForm((f) => ({ ...f, bodyInstagram: e.target.value }))}
                  />
                </label>
              ) : null}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block space-y-1">
                  <ForteV2FormLabel>תאריך פרסום</ForteV2FormLabel>
                  <ForteV2FormInput
                    type="date"
                    value={form.publishDate}
                    onChange={(e) => setForm((f) => ({ ...f, publishDate: e.target.value }))}
                  />
                </label>
                <label className="block space-y-1">
                  <ForteV2FormLabel>שעת פרסום</ForteV2FormLabel>
                  <ForteV2FormInput
                    type="time"
                    value={form.publishTime}
                    onChange={(e) => setForm((f) => ({ ...f, publishTime: e.target.value }))}
                  />
                </label>
              </div>
              <label className="block space-y-1">
                <ForteV2FormLabel>קישור לתמונה (אופציונלי)</ForteV2FormLabel>
                <ForteV2FormInput
                  value={form.imageUrl}
                  onChange={(e) => setForm((f) => ({ ...f, imageUrl: e.target.value }))}
                  placeholder="יועלה בהמשך — ניתן להדביק קישור זמני"
                />
              </label>
              {previewFromForm ? (
                <div>
                  <p className="text-sm font-semibold text-forte-text mb-2">תצוגה מקדימה</p>
                  <PostPreview post={previewFromForm} />
                </div>
              ) : null}
              <div className="flex flex-wrap justify-end gap-2">
                <ForteV2SecondaryButton disabled={busy} onClick={() => setEditorOpen(false)}>
                  ביטול
                </ForteV2SecondaryButton>
                <ForteV2PrimaryButton disabled={busy} onClick={() => void saveDraft()}>
                  {busy ? "שומר..." : "צור טיוטה"}
                </ForteV2PrimaryButton>
              </div>
            </div>
          </ForteV2Dialog>
        </ForteV2DialogOverlay>
      ) : null}

      {previewPost ? (
        <ForteV2DialogOverlay onClose={() => !busy && setPreviewPost(null)}>
          <ForteV2Dialog title="תצוגה מקדימה" onClose={() => !busy && setPreviewPost(null)}>
            <div className="space-y-4 text-sm">
              <p className="text-forte-text-secondary">
                לאשר או לדחות — השתמשו ב«אישורים הממתינים ליהודה» למטה. לאחר אישור ניתן לתזמן ולפרסם.
              </p>
              <PostPreview post={previewPost} />
              <div className="flex flex-wrap gap-2">
                <ForteV2SecondaryButton disabled={busy} onClick={() => setPreviewPost(null)}>
                  סגור
                </ForteV2SecondaryButton>
              </div>
            </div>
          </ForteV2Dialog>
        </ForteV2DialogOverlay>
      ) : null}

      {pagePickerOpen ? (
        <ForteV2DialogOverlay onClose={() => !busy && setPagePickerOpen(false)}>
          <ForteV2Dialog title="בחירת דף פייסבוק" onClose={() => !busy && setPagePickerOpen(false)}>
            <p className="text-sm text-forte-text-secondary mb-3">
              בחרו את הדף העסקי לפרסום. הבחירה לפי מזהה דף, לא לפי שם בלבד.
            </p>
            <ul className="space-y-2 max-h-64 overflow-auto">
              {pageOptions.map((page) => (
                <li
                  key={page.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-forte-border p-3"
                >
                  <div>
                    <p className="font-medium text-forte-text">{page.name}</p>
                    <p className="text-xs text-forte-text-secondary">מזהה: {page.id}</p>
                  </div>
                  <ForteV2PrimaryButton
                    disabled={busy || !page.canCreateContent}
                    onClick={() => void confirmPageSelection(page.id)}
                  >
                    {page.canCreateContent ? "בחר" : "אין הרשאת פרסום"}
                  </ForteV2PrimaryButton>
                </li>
              ))}
            </ul>
          </ForteV2Dialog>
        </ForteV2DialogOverlay>
      ) : null}

      {deleteTarget ? (
        <ForteV2DialogOverlay onClose={() => !busy && setDeleteTarget(null)}>
          <ForteV2Dialog title="למחוק את הפוסט?" onClose={() => !busy && setDeleteTarget(null)}>
            <p className="text-sm text-forte-text-secondary mb-4">{deleteTarget.topic}</p>
            <div className="flex flex-wrap gap-2">
              <ForteV2DangerButton disabled={busy} onClick={() => void confirmDelete()}>
                מחק
              </ForteV2DangerButton>
              <ForteV2SecondaryButton disabled={busy} onClick={() => setDeleteTarget(null)}>
                ביטול
              </ForteV2SecondaryButton>
            </div>
          </ForteV2Dialog>
        </ForteV2DialogOverlay>
      ) : null}
    </ForteV2TableCard>
  );
}
