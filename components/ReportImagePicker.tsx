"use client";

import { useRef, useState } from "react";
import {
  formatFileSize,
  processImageFile,
  REPORT_IMAGE_STORAGE_NOTE,
  type ReportImageAttachment,
} from "@/lib/report-image";

interface ReportImagePickerProps {
  attachment: ReportImageAttachment | null;
  onChange: (attachment: ReportImageAttachment | null) => void;
}

export default function ReportImagePicker({
  attachment,
  onChange,
}: ReportImagePickerProps) {
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File | undefined) {
    if (!file) return;

    setProcessing(true);
    setError(null);
    const result = await processImageFile(file);
    setProcessing(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    onChange(result.attachment);
  }

  function handleGalleryChange(e: React.ChangeEvent<HTMLInputElement>) {
    void handleFile(e.target.files?.[0]);
    e.target.value = "";
  }

  function handleRemove() {
    setError(null);
    onChange(null);
    if (galleryInputRef.current) galleryInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
    if (replaceInputRef.current) replaceInputRef.current.value = "";
  }

  if (processing) {
    return (
      <div className="bg-gray-light rounded-xl border border-gray-200 px-4 py-8 text-center animate-pulse">
        <p className="text-sm text-navy font-medium">מעבד תמונה...</p>
        <p className="text-xs text-gray-text mt-1">דוחס לשמירה בדפדפן</p>
      </div>
    );
  }

  if (attachment) {
    return (
      <div className="rounded-xl border-2 border-gold/40 bg-gold/5 overflow-hidden animate-fade-up">
        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={attachment.dataUrl}
            alt={`תצוגה מקדימה: ${attachment.name}`}
            className="w-full h-44 object-cover bg-gray-light"
          />
          <span className="absolute top-2 right-2 text-[10px] font-semibold bg-emerald-600 text-white px-2 py-1 rounded-lg shadow-sm">
            ✓ התמונה נקלטה
          </span>
        </div>

        <div className="p-3 space-y-3">
          <div className="bg-white rounded-lg border border-gray-200 px-3 py-2.5">
            <p className="text-sm font-semibold text-navy truncate" title={attachment.name}>
              {attachment.name}
            </p>
            <p className="text-xs text-gray-text mt-0.5">
              גודל לאחר דחיסה: {formatFileSize(attachment.sizeBytes)}
            </p>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => replaceInputRef.current?.click()}
              className="flex-1 rounded-xl border border-gold/50 bg-white text-navy text-sm font-semibold py-2.5 hover:bg-gold/10 transition-colors min-h-[44px]"
            >
              החלף תמונה
            </button>
            <button
              type="button"
              onClick={handleRemove}
              className="flex-1 rounded-xl border border-red-200 bg-red-50 text-red-700 text-sm font-semibold py-2.5 hover:bg-red-100 transition-colors min-h-[44px]"
            >
              הסר תמונה
            </button>
          </div>

          <input
            ref={replaceInputRef}
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={handleGalleryChange}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row gap-2">
        <button
          type="button"
          onClick={() => cameraInputRef.current?.click()}
          className="flex-1 flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-200 bg-gray-light px-4 py-4 hover:border-gold/50 transition-colors min-h-[52px]"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5 text-gold shrink-0">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
          </svg>
          <span className="text-sm font-semibold text-navy">צילום מהמצלמה</span>
        </button>

        <button
          type="button"
          onClick={() => galleryInputRef.current?.click()}
          className="flex-1 flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-200 bg-gray-light px-4 py-4 hover:border-gold/50 transition-colors min-h-[52px]"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5 text-gold shrink-0">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
          </svg>
          <span className="text-sm font-semibold text-navy">בחירה מהגלריה</span>
        </button>
      </div>

      <p className="text-xs text-gray-text text-center">אופציונלי — מסייע בזיהוי התקלה</p>
      <p className="text-[11px] text-navy/60 leading-relaxed bg-white border border-gray-200 rounded-lg px-3 py-2">
        {REPORT_IMAGE_STORAGE_NOTE}
      </p>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
          {error}
        </p>
      )}

      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={handleGalleryChange}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={handleGalleryChange}
      />
    </div>
  );
}
