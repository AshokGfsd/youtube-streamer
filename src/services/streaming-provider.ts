/**
 * Server-side streaming provider abstraction.
 *
 * Production target: Mux (https://www.mux.com/docs)
 *   - Direct Upload API for the local video file (browser → Mux, bypassing Vercel)
 *   - Live Streams API with a Simulcast target pointed at YouTube RTMPS
 *   - Webhook events streamed back to /api/provider/webhook
 *
 * IMPORTANT architectural note: Mux's Live Stream API expects an RTMP push
 * from an encoder (FFmpeg/OBS). On Vercel alone you cannot run that encoder.
 * A tiny external worker (Railway / Render / Fly.io) is needed to pull the
 * uploaded asset and push it to the Mux Live Stream RTMP endpoint.
 * This service exposes the contract for that worker via a Simulcast target.
 *
 * When MUX_TOKEN_ID / MUX_TOKEN_SECRET are NOT set, the provider falls back
 * to "demo" mode — a fully simulated lifecycle so the dashboard UX is
 * demonstrable end-to-end without external credentials.
 *
 * This module is server-only. Never import from client code.
 */
import "server-only";

import type {
  StartStreamInput,
  StatusStreamResponse,
  StreamStatus,
  UploadUrlResponse,
} from "@/types/stream";

export type ProviderName = "mux" | "demo";

interface DemoStreamState {
  streamId: string;
  status: StreamStatus;
  startedAt: number | null;
  bytesProcessed: number;
  config: StartStreamInput;
  createdAt: number;
}

// Module-scoped in-memory state for demo mode. On Vercel, function instances
// are ephemeral so this is intended only for local / demo / preview usage.
const demoStreams = new Map<string, DemoStreamState>();
let demoCurrentStreamId: string | null = null;

const YOUTUBE_RTMPS_BASE = "rtmps://a.rtmp.youtube.com/live2";

export function getProviderMode(): ProviderName {
  if (
    process.env.MUX_TOKEN_ID &&
    process.env.MUX_TOKEN_SECRET &&
    process.env.MUX_TOKEN_ID.length > 0 &&
    process.env.MUX_TOKEN_SECRET.length > 0
  ) {
    return "mux";
  }
  return "demo";
}

/**
 * Returns the YouTube RTMPS ingest URL that the provider should simulcast to.
 * The actual stream key (`YOUTUBE_STREAM_KEY`) is stored as a Vercel env var
 * and is NEVER sent to the browser. The provider builds the full URL by
 * joining base + key on the server side.
 */
export function getYoutubeRtmpsUrl(): string {
  const key = process.env.YOUTUBE_STREAM_KEY;
  if (!key) {
    throw new Error(
      "YOUTUBE_STREAM_KEY is not configured. Set it in Vercel env vars."
    );
  }
  return `${YOUTUBE_RTMPS_BASE}/${key}`;
}

/* ------------------------------------------------------------------ */
/* Demo provider implementation                                       */
/* ------------------------------------------------------------------ */

function makeId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
}

async function demoCreateUploadUrl(): Promise<UploadUrlResponse> {
  const uploadId = makeId("upl");
  return {
    uploadId,
    // The browser will recognize provider === "demo" and skip the actual PUT.
    uploadUrl: `demo://upload/${uploadId}`,
    method: "PUT",
    headers: {},
    expiresInSec: 3600,
    provider: "demo",
  };
}

async function demoStartStream(
  input: StartStreamInput
): Promise<{ streamId: string; status: StreamStatus; message: string }> {
  // Only one concurrent demo stream is allowed.
  for (const s of demoStreams.values()) {
    if (s.status === "live" || s.status === "starting") {
      throw new Error(
        `A demo stream is already active (${s.streamId}). Stop it first.`
      );
    }
  }

  const streamId = makeId("str");
  const state: DemoStreamState = {
    streamId,
    status: "starting",
    startedAt: null,
    bytesProcessed: 0,
    config: input,
    createdAt: Date.now(),
  };
  demoStreams.set(streamId, state);
  demoCurrentStreamId = streamId;

  // Simulate the provider lifecycle: starting → live after ~2.5s.
  setTimeout(() => {
    const s = demoStreams.get(streamId);
    if (!s || s.status !== "starting") return;
    s.status = "live";
    s.startedAt = Date.now();
  }, 2500);

  return {
    streamId,
    status: "starting",
    message:
      "Demo broadcast created. Simulating encoder handshake to YouTube RTMPS.",
  };
}

async function demoStopStream(
  streamId: string
): Promise<{ status: StreamStatus; message: string }> {
  const s = demoStreams.get(streamId);
  if (!s) throw new Error(`Demo stream ${streamId} not found.`);
  s.status = "stopping";
  setTimeout(() => {
    const cur = demoStreams.get(streamId);
    if (!cur) return;
    cur.status = "idle";
    cur.startedAt = null;
    if (demoCurrentStreamId === streamId) demoCurrentStreamId = null;
  }, 1500);
  return { status: "stopping", message: "Demo broadcast stopping." };
}

async function demoGetStatus(streamId: string | null): Promise<StatusStreamResponse> {
  if (!streamId) {
    return {
      streamId: null,
      status: "idle",
      message: "No active stream.",
      startedAt: null,
      uptimeSec: null,
      bytesProcessed: null,
      lastUpdated: Date.now(),
      provider: "demo",
    };
  }
  const s = demoStreams.get(streamId);
  if (!s) {
    return {
      streamId,
      status: "idle",
      message: "Stream record not found.",
      startedAt: null,
      uptimeSec: null,
      bytesProcessed: null,
      lastUpdated: Date.now(),
      provider: "demo",
    };
  }
  const uptimeSec =
    s.startedAt && s.status === "live"
      ? Math.floor((Date.now() - s.startedAt) / 1000)
      : null;
  // Fake bitrate of 4.5 Mbps so the dashboard shows a moving bytes counter.
  if (s.status === "live" && s.startedAt) {
    s.bytesProcessed = Math.floor(((Date.now() - s.startedAt) / 1000) * 562_500);
  }
  return {
    streamId: s.streamId,
    status: s.status,
    message:
      s.status === "live"
        ? "Broadcasting to YouTube Live via RTMPS."
        : s.status === "starting"
          ? "Encoder is handshaking with YouTube."
          : s.status === "stopping"
            ? "Tearing down broadcast."
            : "Idle.",
    startedAt: s.startedAt,
    uptimeSec,
    bytesProcessed: s.bytesProcessed,
    lastUpdated: Date.now(),
    provider: "demo",
  };
}

/* ------------------------------------------------------------------ */
/* Mux provider implementation (production)                           */
/* ------------------------------------------------------------------ */
/* Real Mux REST API calls. Will only execute if MUX_TOKEN_ID and
   MUX_TOKEN_SECRET are configured. Documented for clarity; tested
   against Mux's documented API surface. */

interface MuxAsset {
  id: string;
  status: "preparing" | "ready" | "errored";
}

interface MuxLiveStream {
  id: string;
  status: "active" | "idle" | "disabled";
  stream_key: string;
  rtmp_url: string;
  simulcast_targets?: { id: string; url: string; status: string }[];
}

function muxAuthHeader(): string {
  const tok = `${process.env.MUX_TOKEN_ID}:${process.env.MUX_TOKEN_SECRET}`;
  return "Basic " + Buffer.from(tok).toString("base64");
}

async function muxCreateUploadUrl(): Promise<UploadUrlResponse> {
  // Mux Direct Uploads: POST /video/v1/uploads
  const res = await fetch("https://api.mux.com/video/v1/uploads", {
    method: "POST",
    headers: {
      Authorization: muxAuthHeader(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      cors_origin: process.env.NEXT_PUBLIC_APP_URL ?? "*",
      new_asset_settings: { playback_policy: ["private"] },
    }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Mux upload-url request failed: ${res.status} ${txt}`);
  }
  const json = (await res.json()) as {
    data: {
      id: string;
      url: string;
      timeout: number;
      headers: Record<string, string>;
    };
  };
  return {
    uploadId: json.data.id,
    uploadUrl: json.data.url,
    method: "PUT",
    headers: json.data.headers ?? {},
    expiresInSec: json.data.timeout,
    provider: "mux",
  };
}

async function muxStartStream(
  input: StartStreamInput
): Promise<{ streamId: string; status: StreamStatus; message: string }> {
  // 1) Wait for the uploaded asset to be ready.
  //    The uploadId IS the asset source. After the browser PUTs the file
  //    Mux creates the asset asynchronously. We poll its status briefly.
  let asset: MuxAsset | null = null;
  for (let i = 0; i < 30; i++) {
    const r = await fetch(
      `https://api.mux.com/video/v1/uploads/${input.videoUploadId}`,
      { headers: { Authorization: muxAuthHeader() } }
    );
    if (!r.ok) break;
    const j = (await r.json()) as { data: { asset_id?: string; status: string } };
    if (j.data.asset_id) {
      const ar = await fetch(
        `https://api.mux.com/video/v1/assets/${j.data.asset_id}`,
        { headers: { Authorization: muxAuthHeader() } }
      );
      asset = (await ar.json()) as MuxAsset;
      if (asset.status === "ready") break;
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  if (!asset || asset.status !== "ready") {
    throw new Error(
      "Uploaded asset is not ready yet, or the upload did not complete. Try again in a few seconds."
    );
  }

  // 2) Create a Live Stream + a Simulcast target pointing at YouTube RTMPS.
  //    A separate worker (NOT on Vercel) must pull the asset and push it to
  //    `rtmp_url` with the right `stream_key`. That worker is out of scope
  //    for Vercel-only deployments.
  const rtmpsUrl = getYoutubeRtmpsUrl();
  const res = await fetch("https://api.mux.com/video/v1/live-streams", {
    method: "POST",
    headers: {
      Authorization: muxAuthHeader(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      reconnect_window: 60,
      new_asset_settings: { playback_policy: ["public"] },
      simulcast_targets: [{ url: rtmpsUrl, passthrough: "youtube-live" }],
    }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Mux live-stream create failed: ${res.status} ${txt}`);
  }
  const ls = ((await res.json()) as { data: MuxLiveStream }).data;

  return {
    streamId: ls.id,
    status: "starting",
    message: `Mux live stream ${ls.id} created. Encoder must push to ${ls.rtmp_url}.`,
  };
}

async function muxStopStream(
  streamId: string
): Promise<{ status: StreamStatus; message: string }> {
  // Disable the live stream so Mux stops accepting input.
  const res = await fetch(
    `https://api.mux.com/video/v1/live-streams/${streamId}/disable`,
    { method: "PUT", headers: { Authorization: muxAuthHeader() } }
  );
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Mux disable failed: ${res.status} ${txt}`);
  }
  return { status: "stopping", message: "Mux live stream disabled." };
}

async function muxGetStatus(streamId: string | null): Promise<StatusStreamResponse> {
  if (!streamId) {
    return {
      streamId: null,
      status: "idle",
      message: "No active stream.",
      startedAt: null,
      uptimeSec: null,
      bytesProcessed: null,
      lastUpdated: Date.now(),
      provider: "mux",
    };
  }
  const r = await fetch(
    `https://api.mux.com/video/v1/live-streams/${streamId}`,
    { headers: { Authorization: muxAuthHeader() } }
  );
  if (!r.ok) {
    return {
      streamId,
      status: "error",
      message: `Mux status fetch failed: ${r.status}`,
      startedAt: null,
      uptimeSec: null,
      bytesProcessed: null,
      lastUpdated: Date.now(),
      provider: "mux",
    };
  }
  const j = (await r.json()) as {
    data: MuxLiveStream & { active_ingress_address?: string };
  };
  const status: StreamStatus =
    j.data.status === "active" ? "live" : j.data.status === "disabled" ? "idle" : "starting";
  return {
    streamId: j.data.id,
    status,
    message:
      status === "live"
        ? "Broadcasting to YouTube Live via Mux Simulcast."
        : status === "starting"
          ? "Mux live stream waiting for encoder input."
          : "Mux live stream is offline.",
    startedAt: status === "live" ? Date.now() : null,
    uptimeSec: null,
    bytesProcessed: null,
    lastUpdated: Date.now(),
    provider: "mux",
  };
}

/* ------------------------------------------------------------------ */
/* Unified facade                                                     */
/* ------------------------------------------------------------------ */

export const streamingProvider = {
  mode: getProviderMode,

  async createUploadUrl(): Promise<UploadUrlResponse> {
    return getProviderMode() === "mux"
      ? muxCreateUploadUrl()
      : demoCreateUploadUrl();
  },

  async startStream(input: StartStreamInput): Promise<{
    streamId: string;
    status: StreamStatus;
    message: string;
  }> {
    return getProviderMode() === "mux"
      ? muxStartStream(input)
      : demoStartStream(input);
  },

  async stopStream(streamId: string): Promise<{
    status: StreamStatus;
    message: string;
  }> {
    return getProviderMode() === "mux"
      ? muxStopStream(streamId)
      : demoStopStream(streamId);
  },

  async getStatus(streamId: string | null): Promise<StatusStreamResponse> {
    return getProviderMode() === "mux"
      ? muxGetStatus(streamId)
      : demoGetStatus(streamId);
  },
};
