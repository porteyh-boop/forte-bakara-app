"use client";

import { useCallback, useState } from "react";
import FaultImageLightbox from "@/components/FaultImageLightbox";
import { formatFileSize } from "@/lib/report-image";
import {
  downloadFaultReportImage,
  type FaultReportImage,
} from "@/lib/fault-images";

export function useFaultReportImageViewer(images: FaultReportImage[]) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [downloading, setDownloading] = useState(false);

  const openImage = useCallback(
    (index = 0) => {
      if (images.length === 0) return;
      setActiveIndex(Math.min(Math.max(index, 0), images.length - 1));
      setLightboxOpen(true);
    },
    [images.length]
  );

  const downloadImage = useCallback(
    async (index = activeIndex) => {
      const image = images[index];
      if (!image || downloading) return;
      setDownloading(true);
      try {
        await downloadFaultReportImage(image);
      } catch {
        window.alert("הורדת התמונה נכשלה");
      } finally {
        setDownloading(false);
      }
    },
    [activeIndex, downloading, images]
  );

  const lightbox = (
    <FaultImageLightbox
      images={images}
      initialIndex={activeIndex}
      open={lightboxOpen}
      onClose={() => setLightboxOpen(false)}
    />
  );

  return {
    lightbox,
    openImage,
    downloadImage,
    downloading,
    hasImages: images.length > 0,
  };
}

interface FaultReportImageThumbnailsProps {
  images: FaultReportImage[];
  compact?: boolean;
  onOpen: (index: number) => void;
}

export function FaultReportImageThumbnails({
  images,
  compact = false,
  onOpen,
}: FaultReportImageThumbnailsProps) {
  if (images.length === 0) return null;

  return (
    <div className={compact ? "mt-2" : "mt-3"}>
      <div
        className={`grid gap-2 ${
          images.length > 1 ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-1"
        }`}
      >
        {images.map((image, index) => (
          <button
            key={`${image.src}-${index}`}
            type="button"
            onClick={() => onOpen(index)}
            className="group rounded-xl overflow-hidden border border-gray-200 bg-gray-light text-right focus:outline-none focus-visible:ring-2 focus-visible:ring-navy/40"
            aria-label={`פתיחת תמונה: ${image.name}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={image.src}
              alt={`תמונה מצורפת: ${image.name}`}
              loading={image.fromStorage ? "lazy" : undefined}
              decoding="async"
              className={`w-full object-cover transition-opacity group-hover:opacity-90 ${
                compact ? "h-28" : "h-36"
              }`}
            />
            <p className="text-[10px] text-gray-text px-2 py-1.5 truncate">
              {image.name}
              {images.length > 1 ? ` · ${index + 1}/${images.length}` : ""}
            </p>
          </button>
        ))}
      </div>

      {images.length === 1 && images[0].sizeBytes != null && (
        <p className="text-[10px] text-gray-text mt-1">
          {images[0].name} · {formatFileSize(images[0].sizeBytes)}
        </p>
      )}
    </div>
  );
}
