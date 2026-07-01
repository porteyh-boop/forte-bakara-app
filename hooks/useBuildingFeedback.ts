"use client";

import { useCallback, useEffect, useState } from "react";
import { useBuilding } from "@/components/BuildingProvider";
import {
  FEEDBACK_UPDATED_EVENT,
  getFeedbackByBuilding,
} from "@/lib/feedback-storage";
import type { PilotFeedback } from "@/lib/types";

export function useBuildingFeedback() {
  const { buildingId, isReady } = useBuilding();
  const [feedback, setFeedback] = useState<PilotFeedback[]>([]);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(() => {
    if (!isReady) return;
    setFeedback(getFeedbackByBuilding(buildingId));
    setReady(true);
  }, [buildingId, isReady]);

  useEffect(() => {
    if (!isReady) {
      setFeedback([]);
      setReady(false);
      return;
    }

    refresh();

    function onFeedbackUpdated(e: Event) {
      const detail = (e as CustomEvent<{ buildingId?: string }>).detail;
      if (!detail?.buildingId || detail.buildingId === buildingId) {
        refresh();
      }
    }

    window.addEventListener(FEEDBACK_UPDATED_EVENT, onFeedbackUpdated);
    return () => {
      window.removeEventListener(FEEDBACK_UPDATED_EVENT, onFeedbackUpdated);
    };
  }, [buildingId, isReady, refresh]);

  return { feedback, ready: isReady && ready, refresh };
}
