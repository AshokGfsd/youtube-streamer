import { NextResponse } from "next/server";
import { streamingProvider } from "@/services/streaming-provider";

/**
 * Returns the current status of the active (or last) stream.
 *
 * Query params:
 *   ?streamId=...   If omitted, the server returns idle status.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const streamId = url.searchParams.get("streamId") || null;

  try {
    const result = await streamingProvider.getStatus(streamId);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
