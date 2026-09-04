"use client";

import { useState } from "react";
import "@/app/forte-v2-design-system.css";
import { ForteV2PrimaryButton } from "@/components/master-v2/project-v2/MasterProjectV2Workspace";
import { establishMasterV2Sessions } from "@/lib/master-v2-auth";
import { FORTE_V2_ROOT_CLASS } from "@/lib/forte-v2-design-system";
import { masterAuthErrorMessage } from "@/lib/master-auth-client";

export default function MasterCodeGate({ onSuccess }: { onSuccess: () => void }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    setError(null);

    const result = await establishMasterV2Sessions(code);
    setSubmitting(false);

    if (!result.ok) {
      setError(masterAuthErrorMessage(result.error));
      return;
    }

    onSuccess();
  }

  return (
    <div
      className={`min-h-screen bg-forte-background flex items-center justify-center p-6 overflow-x-clip ${FORTE_V2_ROOT_CLASS}`}
    >
      <div className="w-full min-w-0 max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-forte-primary text-white text-xl font-black mb-4 shadow-lg">
            F
          </div>
          <h1 className="text-2xl font-extrabold text-forte-primary tracking-tight">
            FORTE
          </h1>
          <p className="text-sm text-forte-text-secondary mt-1">מערכת ניהול הנדסי</p>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="fv2-panel fv2-panel-lg space-y-4">
          <div>
            <h2 className="fv2-section-title text-base">כניסה למערכת</h2>
            <p className="fv2-section-desc mt-1">הזינו קוד גישה פנימי</p>
          </div>
          <div>
            <label htmlFor="gate-code" className="fv2-label">
              קוד גישה
            </label>
            <input
              id="gate-code"
              type="password"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="••••••••"
              className="fv2-input w-full"
              autoComplete="off"
            />
          </div>
          {error && (
            <div className="fv2-banner fv2-banner-error">{error}</div>
          )}
          <ForteV2PrimaryButton type="submit" disabled={submitting}>
            {submitting ? "מאמת..." : "כניסה למערכת"}
          </ForteV2PrimaryButton>
        </form>
      </div>
    </div>
  );
}
