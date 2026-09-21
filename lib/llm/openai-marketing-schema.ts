/** JSON Schema for OpenAI Structured Outputs — exactly 3 marketing posts. */
export const MARKETING_POSTS_BATCH_JSON_SCHEMA = {
  name: "forte_marketing_posts_batch",
  strict: true,
  schema: {
    type: "object",
    properties: {
      posts: {
        type: "array",
        minItems: 3,
        maxItems: 3,
        items: {
          type: "object",
          properties: {
            topic: { type: "string" },
            target_audience: { type: "string" },
            platform: {
              type: "string",
              enum: ["facebook", "instagram", "both"],
            },
            body_facebook: { type: "string" },
            body_instagram: { type: "string" },
            visual_prompt: { type: "string" },
            publish_date: { type: "string" },
            publish_time: { type: "string" },
          },
          required: [
            "topic",
            "target_audience",
            "platform",
            "body_facebook",
            "body_instagram",
            "visual_prompt",
            "publish_date",
            "publish_time",
          ],
          additionalProperties: false,
        },
      },
    },
    required: ["posts"],
    additionalProperties: false,
  },
} as const;

export type OpenAiMarketingPostDraft = {
  topic: string;
  target_audience: string;
  platform: "facebook" | "instagram" | "both";
  body_facebook: string;
  body_instagram: string;
  visual_prompt: string;
  publish_date: string;
  publish_time: string;
};

export type OpenAiMarketingBatchResponse = {
  posts: OpenAiMarketingPostDraft[];
};
