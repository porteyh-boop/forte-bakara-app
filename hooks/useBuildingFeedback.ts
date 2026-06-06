"use client";

import { useCallback, useEffect, useState } from "react";
import { useBuilding } from "@/components/BuildingProvider";
import {
  FEEDBACK_UPDATED_EVENT,
  getFeedbackByBuilding,
} from "@/lib/feedback-storage";
import type { PilotFeedback } from "@/lib/types";

export function useBuildingFeedback() {
  const { buildingId, ready: buildingReady } = useBuilding();
  const [feedback, setFeedback] = useState<PilotFeedback[]>([]);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(() => {
    if (!buildingReady) return;
    setFeedback(getFeedbackByBuilding(buildingId));
    setReady(true);
  }, [buildingId, buildingReady]);

  useEffect(() => {
    if (!buildingReady) {
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

    function onBuildingChanged() {
      setReady(false);
      setFeedback([]);
      refresh();
    }

    window.addEventListener(FEEDBACK_UPDATED_EVENT, onFeedbackUpdated);
    window.addEventListener("forte-building-changed", onBuildingChanged);
    return () => {
      window.removeEventListener(FEEDBACK_UPDATED_EVENT, onFeedbackUpdated);
      window.removeEventListener("forte-building-changed", onBuildingChanged);
    };
  }, [buildingId, buildingReady, refresh]);

  return { feedback, ready: buildingReady && ready, refresh };
}
