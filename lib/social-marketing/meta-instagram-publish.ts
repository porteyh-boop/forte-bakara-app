import { isPublicImageUrlForMetaFetch } from "@/lib/social-marketing/meta-facebook-publish";
import { MetaGraphApiError } from "@/lib/social-marketing/meta-facebook-graph";
import {
  createInstagramMediaContainer,
  fetchInstagramMediaPermalink,
  publishInstagramMediaContainer,
  waitForInstagramContainerReady,
} from "@/lib/social-marketing/meta-instagram-graph";
import type { MetaGraphFetch } from "@/lib/social-marketing/meta-facebook-graph";

export async function publishApprovedInstagramPostContent(input: {
  igUserId: string;
  pageAccessToken: string;
  imageUrl: string;
  caption: string;
  fetchImpl?: MetaGraphFetch;
  signal?: AbortSignal;
}): Promise<{ mediaId: string; permalink: string | null }> {
  const caption = input.caption.trim();
  if (!caption) throw new MetaGraphApiError("instagram_caption_required");
  const imageUrl = input.imageUrl.trim();
  if (!imageUrl) throw new MetaGraphApiError("instagram_image_required");
  if (!isPublicImageUrlForMetaFetch(imageUrl)) {
    throw new MetaGraphApiError("image_url_not_public");
  }

  const { containerId } = await createInstagramMediaContainer({
    igUserId: input.igUserId,
    pageAccessToken: input.pageAccessToken,
    imageUrl,
    caption,
    fetchImpl: input.fetchImpl,
    signal: input.signal,
  });

  await waitForInstagramContainerReady({
    containerId,
    pageAccessToken: input.pageAccessToken,
    fetchImpl: input.fetchImpl,
    signal: input.signal,
  });

  const published = await publishInstagramMediaContainer({
    igUserId: input.igUserId,
    pageAccessToken: input.pageAccessToken,
    creationId: containerId,
    fetchImpl: input.fetchImpl,
    signal: input.signal,
  });

  const permalink = await fetchInstagramMediaPermalink({
    mediaId: published.mediaId,
    pageAccessToken: input.pageAccessToken,
    fetchImpl: input.fetchImpl,
  });

  return { mediaId: published.mediaId, permalink };
}
