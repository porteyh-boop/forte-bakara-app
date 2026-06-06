import type {
  FeedbackRating,
  FeedbackStats,
  FeedbackYesMaybeNo,
  PilotFeedback,
} from "./types";

export const FEEDBACK_SENDER_ROLES = [
  "ועד בית",
  "חברת ניהול",
  "אחזקה",
  "דייר",
  "אחר",
] as const;

export const FEEDBACK_RATINGS: FeedbackRating[] = [5, 4, 3, 2, 1];

export const RATING_LABELS: Record<FeedbackRating, string> = {
  5: "5 - מצוינת",
  4: "4 - טובה",
  3: "3 - סבירה",
  2: "2 - טעונה שיפור",
  1: "1 - לא טובה",
};

export const YES_MAYBE_NO_OPTIONS: FeedbackYesMaybeNo[] = ["כן", "אולי", "לא"];

function emptyYesMaybeNoCounts(): Record<FeedbackYesMaybeNo, number> {
  return { כן: 0, אולי: 0, לא: 0 };
}

export function getFeedbackStats(items: PilotFeedback[]): FeedbackStats {
  const wouldUseCounts = emptyYesMaybeNoCounts();
  const recommendCounts = emptyYesMaybeNoCounts();
  let ratingSum = 0;

  for (const item of items) {
    ratingSum += item.rating;
    wouldUseCounts[item.wouldUseRegularly]++;
    recommendCounts[item.wouldRecommend]++;
  }

  const recent = [...items].sort(
    (a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return {
    total: items.length,
    avgRating:
      items.length > 0
        ? Math.round((ratingSum / items.length) * 10) / 10
        : 0,
    wouldUseYes: wouldUseCounts.כן,
    wouldRecommendYes: recommendCounts.כן,
    wouldUseCounts,
    recommendCounts,
    recent,
  };
}

export function formatFeedbackDate(iso: string): string {
  return new Intl.DateTimeFormat("he-IL", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}
