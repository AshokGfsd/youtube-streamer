import { NextResponse } from "next/server";
import { streamingProvider } from "@/services/streaming-provider";

/**
 * Returns a temporary direct-upload URL for the browser to PUT the local
 * video file to. The file NEVER touches Vercel's request body — it goes
 * directly to the streaming provider's storage.
 *
 * In demo mode (no Mux credentials), the returned URL is a `demo://` URL
 * and the browser client must skip the actual HTTP PUT and simulate progress.
 */
export async function POST() {
  try {
    const result = await streamingProvider.createUploadUrl();
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
