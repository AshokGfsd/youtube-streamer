// Core stream status lifecycle
export type StreamStatus =
  | "idle"
  | "uploading"
  | "starting"
  | "live"
  | "stopping"
  | "error";

// Severity levels for log lines emitted by the dashboard
export type LogLevel = "info" | "success" | "warning" | "error";

export interface LogEntry {
  id: string;
  ts: number;
  level: LogLevel;
  message: string;
}

// Local video file metadata captured at selection time
export interface VideoMeta {
  id: string;
  name: string;
  size: number;
  type: string;
  durationSec?: number;
  width?: number;
  height?: number;
  objectUrl: string;
}

// Configuration chosen by the user before going live
export type ResolutionPreset = "480p" | "720p" | "1080p";

export interface StreamConfig {
  title: string;
  description: string;
  loop: boolean;
  resolution: ResolutionPreset;
  privacy: "public" | "unlisted" | "private";
}

// Server-side contract returned from /api/stream/start
export interface StartStreamRequest {
  videoUploadId: string;
  title: string;
  description?: string;
  loop: boolean;
  resolution: ResolutionPreset;
  privacy: "public" | "unlisted" | "private";
}

export interface StartStreamResponse {
  streamId: string;
  status: StreamStatus;
  provider: "mux" | "demo";
  message: string;
}

// Server-side contract returned from /api/stream/stop
export interface StopStreamResponse {
  streamId: string;
  status: StreamStatus;
  message: string;
}

// Server-side contract returned from /api/stream/status
export interface StatusStreamResponse {
  streamId: string | null;
  status: StreamStatus;
  message: string;
  startedAt: number | null;
  uptimeSec: number | null;
  bytesProcessed: number | null;
  lastUpdated: number;
  provider: "mux" | "demo";
}

// Direct-upload URL contract for the browser → provider upload step
export interface UploadUrlResponse {
  uploadId: string;
  uploadUrl: string;
  method: "PUT";
  headers: Record<string, string>;
  expiresInSec: number;
  provider: "mux" | "demo";
}

// Internal store shape
export interface StreamStoreState {
  status: StreamStatus;
  provider: "mux" | "demo" | "unknown";
  streamId: string | null;
  startedAt: number | null;
  uptimeSec: number | null;
  bytesProcessed: number | null;
  lastStatusFetch: number | null;
  logs: LogEntry[];
  isStarting: boolean;
  isStopping: boolean;
  error: string | null;
}
