"use client";

import { useState } from "react";
import { useBuilding } from "@/components/BuildingProvider";
import {
  isFeedbackFormValid,
  saveFeedbackAndNotify,
} from "@/lib/feedback-storage";
import {
  FEEDBACK_RATINGS,
  FEEDBACK_SENDER_ROLES,
  RATING_LABELS,
  YES_MAYBE_NO_OPTIONS,
} from "@/lib/feedback-stats";
import type {
  FeedbackRating,
  FeedbackSenderRole,
  FeedbackYesMaybeNo,
} from "@/lib/types";

interface FeedbackFormProps {
  onSubmitted: () => void;
}

function RadioGroup<T extends string | number>({
  name,
  options,
  value,
  onChange,
  renderLabel,
}: {
  name: string;
  options: readonly T[];
  value: T | "";
  onChange: (v: T) => void;
  renderLabel: (option: T) => string;
}) {
  return (
    <div className="flex flex-col gap-2">
      {options.map((option) => {
        const id = `${name}-${option}`;
        const selected = value === option;
        return (
          <label
            key={id}
            htmlFor={id}
            className={`flex items-center gap-3 rounded-xl border px-4 py-3 cursor-pointer transition-colors ${
              selected
                ? "border-gold bg-gold/10"
                : "border-gray-200 bg-white hover:border-gray-300"
            }`}
          >
            <input
              id={id}
              type="radio"
              name={name}
              checked={selected}
              onChange={() => onChange(option)}
              className="w-4 h-4 accent-gold shrink-0"
            />
            <span className="text-sm text-navy">{renderLabel(option)}</span>
          </label>
        );
      })}
    </div>
  );
}

export default function FeedbackForm({ onSubmitted }: FeedbackFormProps) {
  const { buildingId, ctx, ready } = useBuilding();
  const [senderName, setSenderName] = useState("");
  const [senderRole, setSenderRole] = useState<FeedbackSenderRole | "">("");
  const [rating, setRating] = useState<FeedbackRating | "">("");
  const [wouldUseRegularly, setWouldUseRegularly] = useState<
    FeedbackYesMaybeNo | ""
  >("");
  const [unclearOrMissing, setUnclearOrMissing] = useState("");
  const [expectedFeature, setExpectedFeature] = useState("");
  const [wouldRecommend, setWouldRecommend] = useState<FeedbackYesMaybeNo | "">(
    ""
  );
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const input = {
      senderName,
      senderRole: senderRole as FeedbackSenderRole,
      rating: rating as FeedbackRating,
      wouldUseRegularly: wouldUseRegularly as FeedbackYesMaybeNo,
      unclearOrMissing,
      expectedFeature,
      wouldRecommend: wouldRecommend as FeedbackYesMaybeNo,
    };

    if (!isFeedbackFormValid(input)) {
      setError("נא למלא את כל השדות החובה לפני השליחה.");
      return;
    }

    setSubmitting(true);
    const saved = saveFeedbackAndNotify(input, buildingId, ctx.building.name);
    setSubmitting(false);

    if (!saved) {
      setError("לא ניתן לשמור את המשוב. נסו שוב.");
      return;
    }

    onSubmitted();
  }

  if (!ready) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center animate-pulse">
        <p className="text-sm text-gray-text">טוען...</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      <div className="form-section animate-fade-up">
        <p className="text-xs font-semibold text-gold mb-3">פרטי השולח</p>
        <div className="flex flex-col gap-4">
          <div>
            <label htmlFor="senderName" className="form-label">
              שם השולח
            </label>
            <input
              id="senderName"
              type="text"
              value={senderName}
              onChange={(e) => setSenderName(e.target.value)}
              placeholder="לדוגמה: איתן / מאור / רוי"
              className="form-input"
              autoComplete="name"
            />
          </div>

          <div>
            <p className="form-label mb-2">תפקיד</p>
            <RadioGroup
              name="senderRole"
              options={FEEDBACK_SENDER_ROLES}
              value={senderRole}
              onChange={setSenderRole}
              renderLabel={(role) => role}
            />
          </div>
        </div>
      </div>

      <div className="form-section animate-fade-up animation-delay-100">
        <p className="text-xs font-semibold text-gold mb-3">חוויית שימוש</p>
        <div className="flex flex-col gap-4">
          <div>
            <p className="form-label mb-2">דירוג חוויית שימוש</p>
            <RadioGroup
              name="rating"
              options={FEEDBACK_RATINGS}
              value={rating}
              onChange={setRating}
              renderLabel={(r) => RATING_LABELS[r]}
            />
          </div>

          <div>
            <p className="form-label mb-2">
              האם היית משתמש במערכת באופן שוטף?
            </p>
            <RadioGroup
              name="wouldUseRegularly"
              options={YES_MAYBE_NO_OPTIONS}
              value={wouldUseRegularly}
              onChange={setWouldUseRegularly}
              renderLabel={(v) => v}
            />
          </div>
        </div>
      </div>

      <div className="form-section animate-fade-up animation-delay-200">
        <p className="text-xs font-semibold text-gold mb-3">פירוט</p>
        <div className="flex flex-col gap-4">
          <div>
            <label htmlFor="unclearOrMissing" className="form-label">
              מה היה חסר או לא ברור?
            </label>
            <textarea
              id="unclearOrMissing"
              rows={3}
              value={unclearOrMissing}
              onChange={(e) => setUnclearOrMissing(e.target.value)}
              placeholder="כתבו בקצרה מה לא היה ברור, מה חסר, או מה הייתם משפרים"
              className="form-input resize-none"
            />
          </div>

          <div>
            <label htmlFor="expectedFeature" className="form-label">
              האם יש פעולה שהיית מצפה שהמערכת תעשה ולא קיימת כרגע?
            </label>
            <textarea
              id="expectedFeature"
              rows={3}
              value={expectedFeature}
              onChange={(e) => setExpectedFeature(e.target.value)}
              placeholder="לדוגמה: שליחת עדכון, סיכום חודשי, מעקב אחרי חברת המעליות"
              className="form-input resize-none"
            />
          </div>

          <div>
            <p className="form-label mb-2">
              האם היית ממליץ להשתמש במערכת לבניינים נוספים?
            </p>
            <RadioGroup
              name="wouldRecommend"
              options={YES_MAYBE_NO_OPTIONS}
              value={wouldRecommend}
              onChange={setWouldRecommend}
              renderLabel={(v) => v}
            />
          </div>
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-2xl bg-gradient-to-br from-gold to-[#b8944f] text-navy font-bold text-base py-4 shadow-lg shadow-gold/30 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60"
      >
        {submitting ? "שולח..." : "שלח משוב"}
      </button>
    </form>
  );
}
