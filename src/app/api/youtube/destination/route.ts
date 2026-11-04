import { NextResponse } from "next/server";
import { getYoutubeDestinationInfo } from "@/services/youtube";
import { streamingProvider } from "@/services/streaming-provider";

/**
 * Returns safe-to-expose metadata about the YouTube destination and the
 * streaming provider. The actual stream key is NEVER returned.
 */
export async function GET() {
  return NextResponse.json({
    youtube: getYoutubeDestinationInfo(),
    provider: streamingProvider.mode(),
  });
}
