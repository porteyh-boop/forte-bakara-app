"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type TouchEvent as ReactTouchEvent,
  type WheelEvent as ReactWheelEvent,
} from "react";
import {
  clampFaultImageZoom,
  downloadFaultReportImage,
  isFaultImageLightboxCloseKey,
  restoreFaultImageLightboxScroll,
  shouldCloseFaultImageLightboxOnBackdrop,
  type FaultReportImage,
} from "@/lib/fault-images";

interface FaultImageLightboxProps {
  images: FaultReportImage[];
  initialIndex?: number;
  open: boolean;
  onClose: () => void;
}

function touchPointsDistance(
  touchA: { clientX: number; clientY: number },
  touchB: { clientX: number; clientY: number }
): number {
  return Math.hypot(touchA.clientX - touchB.clientX, touchA.clientY - touchB.clientY);
}

export default function FaultImageLightbox({
  images,
  initialIndex = 0,
  open,
  onClose,
}: FaultImageLightboxProps) {
  const [index, setIndex] = useState(initialIndex);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, offsetX: 0, offsetY: 0 });
  const pinchStart = useRef<{ distance: number; scale: number } | null>(null);
  const backdropRef = useRef<HTMLButtonElement>(null);
  const scrollYRef = useRef(0);

  const current = images[index];

  const resetView = useCallback(() => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  }, []);

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  const handleBackdropClose = useCallback(
    (event: ReactMouseEvent<HTMLButtonElement>) => {
      if (shouldCloseFaultImageLightboxOnBackdrop(event.target, backdropRef.current)) {
        handleClose();
      }
    },
    [handleClose]
  );

  useEffect(() => {
    if (!open) return;
    setIndex(Math.min(Math.max(initialIndex, 0), Math.max(images.length - 1, 0)));
    resetView();
  }, [open, initialIndex, images.length, resetView]);

  useEffect(() => {
    if (!open) return;

    scrollYRef.current = window.scrollY;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(event: KeyboardEvent) {
      if (isFaultImageLightboxCloseKey(event.key)) {
        event.preventDefault();
        handleClose();
        return;
      }
      if (event.key === "ArrowRight") {
        setIndex((value) => (value + 1) % images.length);
        resetView();
      }
      if (event.key === "ArrowLeft") {
        setIndex((value) => (value - 1 + images.length) % images.length);
        resetView();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
      restoreFaultImageLightboxScroll(scrollYRef.current);
    };
  }, [open, images.length, handleClose, resetView]);

  function goNext() {
    if (images.length <= 1) return;
    setIndex((value) => (value + 1) % images.length);
    resetView();
  }

  function goPrev() {
    if (images.length <= 1) return;
    setIndex((value) => (value - 1 + images.length) % images.length);
    resetView();
  }

  function handleWheel(event: ReactWheelEvent<HTMLDivElement>) {
    event.preventDefault();
    setScale((value) =>
      clampFaultImageZoom(value + (event.deltaY < 0 ? 0.12 : -0.12))
    );
  }

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (scale <= 1) return;
    setDragging(true);
    dragStart.current = {
      x: event.clientX,
      y: event.clientY,
      offsetX: offset.x,
      offsetY: offset.y,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!dragging) return;
    setOffset({
      x: dragStart.current.offsetX + (event.clientX - dragStart.current.x),
      y: dragStart.current.offsetY + (event.clientY - dragStart.current.y),
    });
  }

  function handlePointerUp(event: React.PointerEvent<HTMLDivElement>) {
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function handleTouchStart(event: ReactTouchEvent<HTMLDivElement>) {
    if (event.touches.length === 2) {
      pinchStart.current = {
        distance: touchPointsDistance(event.touches[0], event.touches[1]),
        scale,
      };
    }
  }

  function handleTouchMove(event: ReactTouchEvent<HTMLDivElement>) {
    if (event.touches.length !== 2 || !pinchStart.current) return;
    event.preventDefault();
    const distance = touchPointsDistance(event.touches[0], event.touches[1]);
    if (distance <= 0 || pinchStart.current.distance <= 0) return;
    const ratio = distance / pinchStart.current.distance;
    setScale(clampFaultImageZoom(pinchStart.current.scale * ratio));
  }

  function handleTouchEnd() {
    pinchStart.current = null;
  }

  async function handleDownload() {
    if (!current || downloading) return;
    setDownloading(true);
    try {
      await downloadFaultReportImage(current);
    } catch {
      window.alert("הורדת התמונה נכשלה");
    } finally {
      setDownloading(false);
    }
  }

  if (!open || !current) return null;

  return (
    <div
      className="fixed inset-0 z-[100]"
      role="dialog"
      aria-modal="true"
      aria-label="תצוגת תמונה מלאה"
    >
      <button
        ref={backdropRef}
        type="button"
        tabIndex={-1}
        aria-label="סגירת תצוגת תמונה"
        className="absolute inset-0 bg-black/90"
        onClick={handleBackdropClose}
      />

      <button
        type="button"
        onClick={handleClose}
        className="absolute top-3 end-3 z-[110] flex h-12 w-12 items-center justify-center rounded-full border-2 border-white/40 bg-black/60 text-2xl font-bold leading-none text-white shadow-lg hover:bg-black/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
        aria-label="סגירה"
      >
        ✕
      </button>

      <div className="relative z-[105] flex h-full flex-col pointer-events-none">
        <div
          className="pointer-events-auto flex items-center justify-between gap-2 px-3 py-2 pt-16 text-white shrink-0 sm:pt-2"
          onClick={(event) => event.stopPropagation()}
        >
          <p className="text-xs sm:text-sm truncate">
            {current.name}
            {images.length > 1 && (
              <span className="mr-2 text-white/70">
                ({index + 1}/{images.length})
              </span>
            )}
          </p>
          <div className="hidden sm:flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => setScale((value) => clampFaultImageZoom(value - 0.25))}
              className="rounded-lg border border-white/20 px-2.5 py-1.5 text-xs font-semibold hover:bg-white/10"
              aria-label="הקטנת תמונה"
            >
              −
            </button>
            <span className="text-xs tabular-nums w-10 text-center">
              {Math.round(scale * 100)}%
            </span>
            <button
              type="button"
              onClick={() => setScale((value) => clampFaultImageZoom(value + 0.25))}
              className="rounded-lg border border-white/20 px-2.5 py-1.5 text-xs font-semibold hover:bg-white/10"
              aria-label="הגדלת תמונה"
            >
              +
            </button>
            <button
              type="button"
              onClick={() => void handleDownload()}
              disabled={downloading}
              className="rounded-lg border border-white/20 px-2.5 py-1.5 text-xs font-semibold hover:bg-white/10 disabled:opacity-50"
            >
              {downloading ? "מוריד..." : "הורד תמונה"}
            </button>
            <button
              type="button"
              onClick={handleClose}
              className="rounded-lg border border-white/20 px-2.5 py-1.5 text-xs font-semibold hover:bg-white/10"
            >
              סגור
            </button>
          </div>
        </div>

        <div className="relative flex-1 min-h-0 overflow-hidden touch-none pointer-events-auto">
          {images.length > 1 && (
            <>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  goPrev();
                }}
                className="absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/50 text-white w-10 h-10 text-lg hover:bg-black/70"
                aria-label="תמונה קודמת"
              >
                ‹
              </button>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  goNext();
                }}
                className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/50 text-white w-10 h-10 text-lg hover:bg-black/70"
                aria-label="תמונה הבאה"
              >
                ›
              </button>
            </>
          )}

          <div
            className="absolute inset-0 flex items-center justify-center p-4"
            onClick={handleClose}
            onWheel={handleWheel}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onTouchCancel={handleTouchEnd}
          >
            <div
              className={`max-h-full max-w-full ${
                scale > 1 ? (dragging ? "cursor-grabbing" : "cursor-grab") : ""
              }`}
              onClick={(event) => event.stopPropagation()}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                key={current.src}
                src={current.src}
                alt={current.name}
                draggable={false}
                className="max-h-[calc(100vh-10rem)] max-w-full object-contain select-none sm:max-h-[calc(100vh-6rem)]"
                style={{
                  transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
                  transformOrigin: "center center",
                }}
              />
            </div>
          </div>
        </div>

        <div className="pointer-events-auto sm:hidden border-t border-white/15 bg-black/70 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={handleClose}
            className="w-full rounded-xl bg-white text-navy py-4 text-base font-bold shadow-lg hover:bg-gray-100"
          >
            סגור
          </button>
        </div>
      </div>
    </div>
  );
}
