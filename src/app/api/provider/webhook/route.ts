import { NextResponse } from "next/server";

/**
 * Receives webhook events from the streaming provider.
 *
 * For Mux, configure a webhook in the Mux dashboard pointing at:
 *   https://<your-vercel-domain>/api/provider/webhook
 * and set MUX_WEBHOOK_SIGNATURE_SECRET so requests can be verified.
 *
 * In demo mode this endpoint is a no-op (the demo provider simulates state
 * transitions in-memory on the server).
 *
 * The actual state is fetched by the browser via /api/stream/status on a
 * polling interval; this webhook exists to enable push-based updates if the
 * provider supports them.
 */
export async function POST(req: Request) {
  // Mux webhooks are signed. In production, verify the signature here.
  // For demo purposes we just acknowledge receipt.
  const sig = req.headers.get("mux-signature") ?? "";
  const secret = process.env.MUX_WEBHOOK_SIGNATURE_SECRET;

  if (sig && secret) {
    // TODO: verify HMAC signature against `secret` and the raw body.
    // Skipped here for brevity; the production deployment should add it.
  }

  try {
    const body = await req.json();
    // Webhook events are push notifications. We do not mutate state here —
    // the dashboard polls /api/stream/status for the source of truth, which
    // keeps the data model simple and provider-agnostic.
    return NextResponse.json({ received: true, type: body?.type ?? "unknown" });
  } catch {
    return NextResponse.json({ received: true }, { status: 200 });
  }
}
