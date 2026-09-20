export const CONTENT_CHANNELS = ["whatsapp", "email", "phone"] as const;

export type ContentChannelId = (typeof CONTENT_CHANNELS)[number];

export const CONTENT_CHANNEL_LABELS: Record<ContentChannelId, string> = {
  whatsapp: "WhatsApp",
  email: "דוא\"ל",
  phone: "שיחת טלפון",
};

export type ContentDraftInput = {
  contactName: string;
  organizationName: string;
  buildingName: string;
  city: string;
  candidateType: string;
  candidateTypeLabel: string;
  sourceUrl: string;
  qualifyVerdict: string | null;
  qualifyReason: string | null;
  publicNotes: string;
};

export type ContentDraftDto = {
  id: string;
  scoutLeadCandidateId: string;
  salesLeadId: string | null;
  channel: ContentChannelId;
  draftText: string;
  createdAt: string;
  updatedAt: string;
};
