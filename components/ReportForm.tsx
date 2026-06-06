"use client";

import { useState } from "react";
import Link from "next/link";
import { elevators, faultTypes } from "@/lib/data";

export default function ReportForm() {
  const [elevatorId, setElevatorId] = useState("");
  const [faultType, setFaultType] = useState("");
  const [isDisabled, setIsDisabled] = useState(false);
  const [description, setDescription] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageName, setImageName] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const selectedElevator = elevators.find((e) => e.id === elevatorId);
  const isValid = elevatorId && faultType && description.trim().length >= 10;

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) {
      setImageName("");
      setImagePreview(null);
      return;
    }
    setImageName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => setImagePreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid) return;
    setSubmitting(true);
    setTimeout(() => {
      setSubmitting(false);
      setSubmitted(true);
    }, 1200);
  }

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-6 text-center animate-scale-in">
        <div className="w-20 h-20 rounded-full bg-emerald-50 flex items-center justify-center mb-5 ring-4 ring-emerald-100">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-10 h-10 text-emerald-600">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-navy mb-2">הדיווח נשלח בהצלחה</h2>
        <p className="text-gray-text text-sm leading-relaxed max-w-xs">
          התקלה דווחה לחברת המעליות. צוות הטיפול ייצור קשר בהקדם.
        </p>
        <div className="flex flex-col gap-3 w-full mt-8">
          <Link href="/" className="btn-primary text-center">
            חזרה לדף הבית
          </Link>
          <button
            type="button"
            onClick={() => {
              setSubmitted(false);
              setElevatorId("");
              setFaultType("");
              setIsDisabled(false);
              setDescription("");
              setImageName("");
              setImagePreview(null);
            }}
            className="text-sm font-medium text-gold hover:text-gold/80 transition-colors"
          >
            דיווח תקלה נוספת
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="form-section animate-fade-up">
        <p className="text-xs font-semibold text-gold mb-3">פרטי מעלית</p>
        <label htmlFor="elevator" className="form-label">
          בחירת מעלית
        </label>
        <select
          id="elevator"
          required
          value={elevatorId}
          onChange={(e) => setElevatorId(e.target.value)}
          className="form-input"
        >
          <option value="">בחרו מעלית</option>
          {elevators.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name} — {e.status}
            </option>
          ))}
        </select>
        {selectedElevator && selectedElevator.status === "מושבתת" && (
          <p className="form-hint text-red-600">
            שימו לב: מעלית זו כבר מושבתת
          </p>
        )}
      </div>

      <div className="form-section animate-fade-up animation-delay-100">
        <p className="text-xs font-semibold text-gold mb-3">פרטי תקלה</p>
        <div className="flex flex-col gap-4">
          <div>
            <label htmlFor="faultType" className="form-label">
              סוג תקלה
            </label>
            <select
              id="faultType"
              required
              value={faultType}
              onChange={(e) => setFaultType(e.target.value)}
              className="form-input"
            >
              <option value="">בחרו סוג תקלה</option>
              {faultTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center justify-between bg-gray-light rounded-xl px-4 py-3.5">
            <div>
              <label htmlFor="isDisabled" className="text-sm font-semibold text-navy">
                האם המעלית מושבתת?
              </label>
              <p className="text-xs text-gray-text mt-0.5">
                סמנו אם המעלית אינה פועלת כלל
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={isDisabled}
              id="isDisabled"
              onClick={() => setIsDisabled(!isDisabled)}
              className={`relative w-12 h-7 rounded-full transition-colors shrink-0 ${
                isDisabled ? "bg-red-500" : "bg-gray-300"
              }`}
            >
              <span
                className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-all duration-200 ${
                  isDisabled ? "end-0.5" : "end-5"
                }`}
              />
            </button>
          </div>

          <div>
            <label htmlFor="description" className="form-label">
              תיאור תקלה
            </label>
            <textarea
              id="description"
              required
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="תארו את התקלה בפירוט — מיקום, תסמינים, נסיבות..."
              className="form-input resize-none"
            />
            <p className="form-hint">
              {description.length < 10
                ? `מינימום 10 תווים (${description.length}/10)`
                : `${description.length} תווים`}
            </p>
          </div>
        </div>
      </div>

      <div className="form-section animate-fade-up animation-delay-200">
        <p className="text-xs font-semibold text-gold mb-3">תיעוד</p>
        <label className="form-label">העלאת תמונה</label>
        {imagePreview ? (
          <div className="relative rounded-xl overflow-hidden border border-gray-200">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imagePreview}
              alt="תצוגה מקדימה"
              className="w-full h-40 object-cover"
            />
            <button
              type="button"
              onClick={() => {
                setImagePreview(null);
                setImageName("");
              }}
              className="absolute top-2 left-2 w-8 h-8 bg-navy/70 text-white rounded-full flex items-center justify-center text-sm hover:bg-navy transition-colors"
            >
              ✕
            </button>
            <p className="text-xs text-gray-text p-2 bg-gray-light truncate">
              {imageName}
            </p>
          </div>
        ) : (
          <label
            htmlFor="image"
            className="flex flex-col items-center justify-center gap-2 bg-gray-light rounded-xl border-2 border-dashed border-gray-200 px-4 py-8 cursor-pointer hover:border-gold/50 transition-colors"
          >
            <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center shadow-sm">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-6 h-6 text-gold">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
              </svg>
            </div>
            <span className="text-sm font-medium text-navy">צלמו או העלו תמונה</span>
            <span className="text-xs text-gray-text">אופציונלי — מסייע בזיהוי התקלה</span>
            <input
              id="image"
              type="file"
              accept="image/*"
              capture="environment"
              className="sr-only"
              onChange={handleImageChange}
            />
          </label>
        )}
      </div>

      <button
        type="submit"
        disabled={!isValid || submitting}
        className="btn-primary mt-1 animate-fade-up animation-delay-200"
      >
        {submitting ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            שולח...
          </span>
        ) : (
          "שליחת דיווח"
        )}
      </button>
    </form>
  );
}
