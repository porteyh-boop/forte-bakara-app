"use client";

import { useState } from "react";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import FeedbackForm from "@/components/FeedbackForm";

export default function FeedbackPageContent() {
  const [submitted, setSubmitted] = useState(false);

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-light">
        <PageHeader
          title="שלח משוב"
          subtitle="תודה על השיתוף"
          badge="משוב פיילוט"
        />

        <main className="page-content -mt-2">
          <div className="bg-white rounded-2xl border border-gray-200 p-6 text-center animate-fade-up shadow-sm">
            <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-4">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                className="w-7 h-7"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <p className="text-sm text-navy leading-relaxed whitespace-pre-line">
              תודה על הזמן שהקדשת.{"\n"}
              המשוב שלך נקלט במערכת פורטה בקרה ויסייע לנו לשפר את השירות.
            </p>

            <div className="flex flex-col gap-2 mt-6">
              <Link
                href="/"
                className="w-full rounded-xl bg-navy text-white font-semibold py-3.5 text-sm transition-colors hover:bg-navy/90"
              >
                חזרה לדף הבית
              </Link>
              <button
                type="button"
                onClick={() => setSubmitted(false)}
                className="w-full rounded-xl border border-gray-200 bg-white text-navy font-semibold py-3.5 text-sm hover:bg-gray-50 transition-colors"
              >
                שליחת משוב נוסף
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-light">
      <PageHeader
        title="שלח משוב"
        subtitle="המשוב שלך מסייע לנו לדייק את המערכת לפני הפיילוט המסחרי."
        badge="משוב פיילוט"
      />

      <main className="page-content -mt-2">
        <div className="mb-4 animate-fade-up">
          <h2 className="text-lg font-bold text-navy">
            עזרו לנו לשפר את פורטה בקרה
          </h2>
        </div>
        <FeedbackForm onSubmitted={() => setSubmitted(true)} />
      </main>
    </div>
  );
}
