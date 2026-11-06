import { NextResponse } from "next/server";
import { startStreamSchema } from "@/lib/validations";
import { streamingProvider } from "@/services/streaming-provider";

/**
 * Allow this route to run for up to 5 minutes — Mux can take 60–120s to
 * process larger uploaded assets before we can create the Live Stream.
 *
 * Default Vercel limits:
 *   - Hobby plan: max 60s (configure in vercel.json or via this export)
 *   - Pro plan:   max 300s
 *   - Enterprise: up to 900s
 *
 * If you're on Hobby and your video takes >60s to process on Mux's side,
 * upgrade to Pro OR decouple this into an async job queue (e.g. QStash).
 */
export const maxDuration = 300;
export const runtime = "nodejs";

/**
 * Starts a broadcast. The browser has already uploaded the local video file
 * directly to the provider (via /api/provider/upload-url), and now passes
 * the `videoUploadId` so the server can create a Live Stream + Simulcast
 * target pointed at YouTube RTMPS.
 *
 * The YouTube stream key is read from a Vercel env var and is NEVER exposed
 * to the browser.
 */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = startStreamSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 }
    );
  }

  try {
    const result = await streamingProvider.startStream(parsed.data);
    return NextResponse.json({
      streamId: result.streamId,
      status: result.status,
      provider: streamingProvider.mode(),
      message: result.message,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
