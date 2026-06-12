"use client";

import {
  FaultReportImageThumbnails,
  useFaultReportImageViewer,
} from "@/components/FaultReportImageSection";
import { resolveFaultReportImagesFromCloud } from "@/lib/fault-images";
import type { PilotCloudFault } from "@/lib/pilot-cloud";

interface MasterCloudFaultCardProps {
  fault: PilotCloudFault;
  actionId: string | null;
  formatDate: (iso: string) => string;
  onClose: (faultId: string) => void;
  onReopen: (faultId: string) => void;
  onDelete: (faultId: string) => void;
}

export default function MasterCloudFaultCard({
  fault,
  actionId,
  formatDate,
  onClose,
  onReopen,
  onDelete,
}: MasterCloudFaultCardProps) {
  const reportImages = resolveFaultReportImagesFromCloud(fault);
  const imageViewer = useFaultReportImageViewer(reportImages);

  return (
    <article className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div>
          <p className="font-semibold text-navy text-sm">{fault.fault_type}</p>
          <p className="text-xs text-gray-text">
            {fault.building_name} · {fault.elevator_name}
          </p>
          {fault.ticket_number && (
            <p className="text-xs text-gold font-medium mt-0.5">
              {fault.ticket_number}
            </p>
          )}
        </div>
        <span className="text-xs font-semibold px-2 py-1 rounded-lg bg-gray-light text-navy shrink-0">
          {fault.status}
        </span>
      </div>

      <p className="text-sm text-navy/80 leading-relaxed">{fault.description}</p>

      <FaultReportImageThumbnails
        images={reportImages}
        onOpen={imageViewer.openImage}
      />
      {imageViewer.lightbox}

      <p className="text-xs text-gray-text mt-2">
        {formatDate(fault.created_at)}
        {fault.source_device_id && (
          <span className="mr-2"> · מכשיר: {fault.source_device_id.slice(0, 12)}…</span>
        )}
        {fault.closed_at && (
          <span className="mr-2"> · נסגר: {formatDate(fault.closed_at)}</span>
        )}
      </p>

      <div className="flex flex-wrap gap-2 mt-3">
        {imageViewer.hasImages && (
          <>
            <button
              type="button"
              onClick={() => imageViewer.openImage(0)}
              className="text-xs font-semibold border border-gray-200 text-navy px-3 py-1.5 rounded-lg hover:bg-gray-50"
            >
              פתח תמונה
            </button>
            <button
              type="button"
              onClick={() => void imageViewer.downloadImage(0)}
              disabled={imageViewer.downloading}
              className="text-xs font-semibold border border-gray-200 text-navy px-3 py-1.5 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              {imageViewer.downloading ? "מוריד..." : "הורד תמונה"}
            </button>
          </>
        )}
        {fault.status !== "סגורה" ? (
          <button
            type="button"
            disabled={actionId === fault.id}
            onClick={() => onClose(fault.id)}
            className="text-xs font-semibold bg-navy text-white px-3 py-1.5 rounded-lg disabled:opacity-50"
          >
            סגור תקלה
          </button>
        ) : (
          <button
            type="button"
            disabled={actionId === fault.id}
            onClick={() => onReopen(fault.id)}
            className="text-xs font-semibold border border-gold text-navy px-3 py-1.5 rounded-lg disabled:opacity-50"
          >
            פתח מחדש
          </button>
        )}
        <button
          type="button"
          disabled={actionId === fault.id}
          onClick={() => onDelete(fault.id)}
          className="text-xs font-semibold border border-red-200 text-red-700 px-3 py-1.5 rounded-lg disabled:opacity-50"
        >
          מחק
        </button>
      </div>
    </article>
  );
}
