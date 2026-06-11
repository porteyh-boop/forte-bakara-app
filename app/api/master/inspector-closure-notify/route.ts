import { NextResponse } from "next/server";
import { Resend } from "resend";
import {
  buildInspectorClosureEmailSubject,
  buildInspectorClosureEmailText,
  INSPECTOR_NOTIFY_EMAIL,
  type InspectorClosureEmailPayload,
} from "@/lib/inspector-closure-email";

function getMasterCodeFromEnv(): string | undefined {
  return process.env.NEXT_PUBLIC_MASTER_CODE;
}

function getResendFromEmail(): string {
  return (
    process.env.RESEND_FROM_EMAIL ??
    "onboarding@resend.dev"
  );
}

export async function POST(request: Request) {
  const masterCode = request.headers.get("x-master-code");
  const expectedCode = getMasterCodeFromEnv();

  if (!expectedCode || masterCode !== expectedCode) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) {
    return NextResponse.json(
      { error: "RESEND_API_KEY is not configured" },
      { status: 503 }
    );
  }

  let payload: InspectorClosureEmailPayload;
  try {
    payload = (await request.json()) as InspectorClosureEmailPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const resend = new Resend(resendApiKey);
  const subject = buildInspectorClosureEmailSubject();
  const text = buildInspectorClosureEmailText(payload);

  const { error } = await resend.emails.send({
    from: getResendFromEmail(),
    to: INSPECTOR_NOTIFY_EMAIL,
    subject,
    text,
  });

  if (error) {
    console.error("[inspector-closure-email] resend failed:", error);
    return NextResponse.json(
      { error: error.message ?? "Email send failed" },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true });
}
