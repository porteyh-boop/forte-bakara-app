"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import SectionTitle from "@/components/SectionTitle";
import type { ClientBuildingClientUpdateDto } from "@/lib/building-client-updates";
import {
  fetchClientBuildingUpdates,
  markClientBuildingUpdateRead,
  openClientBuildingUpdateAttachment,
} from "@/lib/client-portal-api-client";

function formatUpdateDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("he-IL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

interface ClientPortalBuildingUpdatesSectionProps {
  token: string;
  isActive: boolean;
  onUnreadCountDelta: (delta: number) => void;
}

export default function ClientPortalBuildingUpdatesSection({
  token,
  isActive,
  onUnreadCountDelta,
}: ClientPortalBuildingUpdatesSectionProps) {
  const [updates, setUpdates] = useState<ClientBuildingClientUpdateDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openingAttachmentId, setOpeningAttachmentId] = useState<string | null>(
    null
  );
  const markedInSessionRef = useRef(new Set<string>());
  const panelRef = useRef<HTMLElement>(null);
  const readObserverRef = useRef<IntersectionObserver | null>(null);
  const cardNodeRef = useRef(new Map<string, HTMLElement>());

  const loadUpdates = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await fetchClientBuildingUpdates(token);
    setLoading(false);
    if (!result.ok) {
      setError("לא הצלחנו לטעון את העדכונים. נסו שוב.");
      return;
    }
    setUpdates(result.updates);
  }, [token]);

  useEffect(() => {
    if (!isActive) return;
    void loadUpdates();
  }, [isActive, loadUpdates]);

  useEffect(() => {
    if (!isActive) return;
    panelRef.current?.focus({ preventScroll: true });
  }, [isActive]);

  const handleVisibleRead = useCallback(
    (updateId: string) => {
      if (markedInSessionRef.current.has(updateId)) return;
      markedInSessionRef.current.add(updateId);
      void (async () => {
        const result = await markClientBuildingUpdateRead(token, updateId);
        if (!result.ok) {
          markedInSessionRef.current.delete(updateId);
          return;
        }
        if (!result.alreadyRead) {
          onUnreadCountDelta(-1);
        }
        setUpdates((prev) =>
          prev.map((item) =>
            item.id === updateId ? { ...item, isRead: true } : item
          )
        );
      })();
    },
    [token, onUnreadCountDelta]
  );

  useEffect(() => {
    if (!isActive || loading) {
      readObserverRef.current?.disconnect();
      readObserverRef.current = null;
      return;
    }

    readObserverRef.current = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting || entry.intersectionRatio < 0.5) continue;
          const el = entry.target as HTMLElement;
          const updateId = el.dataset.updateId;
          if (!updateId) continue;
          if (el.dataset.isRead === "true") continue;
          handleVisibleRead(updateId);
        }
      },
      { threshold: [0, 0.25, 0.5, 0.75, 1] }
    );

    for (const [updateId, node] of cardNodeRef.current) {
      if (
        node.dataset.isRead !== "true" &&
        !markedInSessionRef.current.has(updateId)
      ) {
        readObserverRef.current.observe(node);
      }
    }

    return () => {
      readObserverRef.current?.disconnect();
      readObserverRef.current = null;
    };
  }, [isActive, loading, handleVisibleRead]);

  const registerUpdateCard = useCallback(
    (updateId: string, isRead: boolean) => (node: HTMLElement | null) => {
      const prev = cardNodeRef.current.get(updateId);
      if (prev && readObserverRef.current) {
        readObserverRef.current.unobserve(prev);
      }
      if (!node) {
        cardNodeRef.current.delete(updateId);
        return;
      }
      cardNodeRef.current.set(updateId, node);
      if (
        isRead ||
        markedInSessionRef.current.has(updateId) ||
        !readObserverRef.current
      ) {
        return;
      }
      readObserverRef.current.observe(node);
    },
    []
  );

  async function handleOpenAttachment(updateId: string) {
    setOpeningAttachmentId(updateId);
    const result = await openClientBuildingUpdateAttachment(token, updateId);
    setOpeningAttachmentId(null);
    if (!result.ok) {
      setError("לא הצלחנו לפתוח את המסמך. נסו שוב.");
    }
  }

  return (
    <section
      ref={panelRef}
      className="client-portal-updates space-y-3 min-w-0"
      aria-label="עדכונים והודעות"
      tabIndex={-1}
    >
      <SectionTitle title="עדכונים והודעות" />

      {loading && (
        <p className="text-sm text-gray-text bg-white rounded-2xl border border-gray-200 p-6 text-center">
          טוען עדכונים...
        </p>
      )}

      {!loading && error && (
        <div
          className="bg-white rounded-2xl border border-gray-200 p-6 text-center space-y-3"
          role="alert"
        >
          <p className="text-sm text-gray-text">{error}</p>
          <button
            type="button"
            onClick={() => void loadUpdates()}
            className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-navy"
          >
            נסה שוב
          </button>
        </div>
      )}

      {!loading && !error && updates.length === 0 && (
        <p className="text-sm text-gray-text bg-white rounded-2xl border border-gray-200 p-6 text-center">
          אין עדכונים חדשים להצגה.
        </p>
      )}

      {!loading && !error && updates.length > 0 && (
        <ul className="client-portal-updates-list space-y-3 list-none p-0 m-0">
          {updates.map((update) => (
            <li key={update.id}>
              <article
                ref={registerUpdateCard(update.id, update.isRead)}
                data-client-update-card
                data-update-id={update.id}
                data-is-read={update.isRead ? "true" : "false"}
                className={`client-portal-update-card bg-white rounded-2xl border p-4 space-y-2 min-w-0 ${
                  update.isRead
                    ? "border-gray-200"
                    : "border-navy/30 ring-1 ring-navy/10"
                }`}
              >
                {!update.isRead && (
                  <span className="inline-block rounded-lg bg-gold/15 border border-gold/30 px-2 py-0.5 text-xs font-bold text-navy">
                    חדש
                  </span>
                )}
                <p className="text-xs text-gray-text">
                  {formatUpdateDateTime(update.publishedAt)} |{" "}
                  {update.updateTypeLabel}
                </p>
                <h3 className="text-sm font-bold text-navy">{update.title}</h3>
                <p className="text-sm text-gray-text whitespace-pre-line break-words">
                  {update.body}
                </p>
                <p className="text-xs font-semibold text-navy">
                  {update.statusLabel}
                </p>
                {update.hasAttachment && (
                  <button
                    type="button"
                    disabled={openingAttachmentId === update.id}
                    onClick={() => void handleOpenAttachment(update.id)}
                    className="text-xs font-semibold text-navy underline disabled:opacity-50"
                    aria-label={
                      update.attachmentTitle
                        ? `צפה במסמך: ${update.attachmentTitle}`
                        : "צפה במסמך"
                    }
                  >
                    {openingAttachmentId === update.id
                      ? "פותח מסמך..."
                      : "צפה במסמך"}
                  </button>
                )}
              </article>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
