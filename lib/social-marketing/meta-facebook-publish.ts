import {
  MetaGraphApiError,
  publishPageFeedPost,
  publishPagePhotoPost,
  type MetaGraphFetch,
} from "@/lib/social-marketing/meta-facebook-graph";

export type FacebookPagePublishMode = "feed" | "photos";

/** Meta must fetch the image without auth — reject signed / non-HTTPS URLs. */
export function isPublicImageUrlForMetaFetch(imageUrl: string): boolean {
  const url = imageUrl.trim();
  if (!url) return false;
  if (!/^https:\/\//i.test(url)) return false;
  if (/[?&]token=/i.test(url)) return false;
  if (/X-Amz-Signature=/i.test(url)) return false;
  return true;
}

export async function publishApprovedFacebookPostContent(input: {
  pageId: string;
  pageAccessToken: string;
  message: string;
  imageUrl: string | null;
  fetchImpl?: MetaGraphFetch;
  signal?: AbortSignal;
}): Promise<{ facebookPostId: string; mode: FacebookPagePublishMode }> {
  const message = input.message.trim();
  if (!message) throw new MetaGraphApiError("publish_message_required");

  const imageUrl = input.imageUrl?.trim() ?? "";
  if (imageUrl) {
    if (!isPublicImageUrlForMetaFetch(imageUrl)) {
      throw new MetaGraphApiError("image_url_not_public");
    }
    const photo = await publishPagePhotoPost({
      pageId: input.pageId,
      pageAccessToken: input.pageAccessToken,
      imageUrl,
      caption: message,
      fetchImpl: input.fetchImpl,
      signal: input.signal,
    });
    return { facebookPostId: photo.graphPostId, mode: "photos" };
  }

  const feed = await publishPageFeedPost({
    pageId: input.pageId,
    pageAccessToken: input.pageAccessToken,
    message,
    fetchImpl: input.fetchImpl,
    signal: input.signal,
  });
  return { facebookPostId: feed.id, mode: "feed" };
}
