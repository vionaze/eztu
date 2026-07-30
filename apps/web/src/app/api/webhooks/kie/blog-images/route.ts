import { NextResponse } from "next/server";
import {
  reconcileBlogImageGenerationByTaskId,
} from "@/lib/blog-image-generation";
import {
  extractKieCallbackTaskId,
  verifyKieWebhookSignature,
} from "@/lib/kie-image";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

function getToleranceSeconds(): number {
  const parsed = Number(process.env.KIE_WEBHOOK_TOLERANCE_SECONDS || "300");
  return Number.isFinite(parsed)
    ? Math.max(60, Math.min(Math.trunc(parsed), 900))
    : 300;
}

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null);
  const taskId = extractKieCallbackTaskId(payload);
  const timestamp = request.headers.get("x-webhook-timestamp") || "";
  const signature = request.headers.get("x-webhook-signature") || "";
  const hmacKey = process.env.KIE_WEBHOOK_HMAC_KEY?.trim() || "";

  if (
    !verifyKieWebhookSignature({
      taskId,
      timestamp,
      signature,
      key: hmacKey,
      toleranceSeconds: getToleranceSeconds(),
    })
  ) {
    return NextResponse.json(
      { error: "Invalid KIE webhook signature." },
      { status: 401 }
    );
  }

  try {
    const generation =
      await reconcileBlogImageGenerationByTaskId(taskId);
    return NextResponse.json(
      generation
        ? { ok: true, status: generation.status }
        : { ok: true, ignored: true },
      { status: generation ? 200 : 202 }
    );
  } catch (error) {
    console.error("[webhooks/kie/blog-images POST]", error);
    return NextResponse.json(
      { error: "KIE image callback could not be processed." },
      { status: 500 }
    );
  }
}
