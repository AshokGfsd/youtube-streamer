import { NextResponse } from "next/server";
import { streamingProvider } from "@/services/streaming-provider";

/**
 * Forcibly clears all in-memory demo streams. Useful for recovering from a
 * stuck "starting" state without restarting the dev server.
 *
 * In Mux mode this is a no-op (returns cleared: 0) — production streams are
 * external state and must be stopped via the normal stop endpoint.
 */
export async function POST() {
  const result = await streamingProvider.resetAll();
  return NextResponse.json({
    ...result,
    message:
      result.provider === "demo"
        ? result.cleared > 0
          ? `Cleared ${result.cleared} demo stream(s).`
          : "No demo streams to clear."
        : "Reset is a no-op in Mux mode — use /api/stream/stop instead.",
  });
}
