/**
 * YouTube destination helpers.
 *
 * On Vercel-only deployments, the YouTube stream key MUST stay on the server.
 * This module exposes only metadata (channel name, connection state) that is
 * safe to surface to the browser.
 */
import "server-only";

export function getYoutubeDestinationInfo() {
  const streamKey = process.env.YOUTUBE_STREAM_KEY ?? "";
  const channelName = process.env.YOUTUBE_CHANNEL_NAME ?? "Connected YouTube channel";
  const hasStreamKey = streamKey.length > 0;
  return {
    channelName,
    connected: hasStreamKey,
    // The stream key itself is intentionally NOT returned.
    streamKeyPreview: hasStreamKey ? `${streamKey.slice(0, 4)}••••${streamKey.slice(-3)}` : "Not configured",
  };
}
