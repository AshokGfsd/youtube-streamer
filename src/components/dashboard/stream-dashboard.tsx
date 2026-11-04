"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Youtube,
  Radio,
  Settings2,
  ShieldCheck,
  Info,
  Terminal,
  Loader2,
  Plug,
  RotateCcw,
} from "lucide-react";
import { useVideo } from "@/hooks/use-video";
import { useStream } from "@/hooks/use-stream";
import { useStreamStore } from "@/stores/stream-store";
import {
  useSettingsStore,
  resolveTitleTemplate,
} from "@/stores/settings-store";
import { VideoUpload } from "./video-upload";
import { VideoPreview } from "./video-preview";
import { StreamControls } from "./stream-controls";
import { StreamStatus as StreamStatusPanel } from "./stream-status";
import { StreamLogs } from "./stream-logs";
import { SettingsDialog } from "./settings-dialog";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type {
  StreamConfig,
  StreamStatus,
  UploadUrlResponse,
} from "@/types/stream";

const DEFAULT_CONFIG: StreamConfig = {
  title: "",
  description: "",
  loop: true,
  resolution: "720p",
  privacy: "public",
};

interface DestinationInfo {
  youtube: {
    channelName: string;
    connected: boolean;
    streamKeyPreview: string;
  };
  provider: "mux" | "demo";
}

export function StreamDashboard() {
  const { video, error, isProbing, selectFile, clear } = useVideo();
  const { requestUploadUrl, uploadFile, startLive, stopLive } = useStream();
  const store = useStreamStore();
  const settings = useSettingsStore();
  const settingsHydrated = useSettingsStore((s) => s._hydrated);

  // Track whether the user has begun interacting with the form. Once they have,
  // we never overwrite their values from settings.
  const configDirtyRef = useRef(false);
  const appliedHydrationRef = useRef(false);

  // Build the initial config from settings, falling back to DEFAULT_CONFIG
  // when the settings store hasn't hydrated yet.
  const initialConfig: StreamConfig = useMemo(
    () =>
      settingsHydrated
        ? {
            title: "",
            description: settings.defaultDescription,
            loop: settings.defaultLoop,
            resolution: settings.defaultResolution,
            privacy: settings.defaultPrivacy,
          }
        : DEFAULT_CONFIG,
    [settingsHydrated, settings]
  );
  const [config, setConfig] = useState<StreamConfig>(initialConfig);

  // When settings hydrate AFTER first render (e.g. localStorage read finishes),
  // apply the defaults once if the user hasn't touched the form yet.
  // We defer the setState via requestAnimationFrame so it's NOT synchronous
  // inside the effect body, avoiding cascading renders.
  useEffect(() => {
    if (!settingsHydrated) return;
    if (appliedHydrationRef.current) return;
    if (configDirtyRef.current) {
      appliedHydrationRef.current = true;
      return;
    }
    if (store.status !== "idle" || store.streamId) {
      appliedHydrationRef.current = true;
      configDirtyRef.current = true;
      return;
    }
    appliedHydrationRef.current = true;
    const id = requestAnimationFrame(() => {
      setConfig({
        title: "",
        description: settings.defaultDescription,
        loop: settings.defaultLoop,
        resolution: settings.defaultResolution,
        privacy: settings.defaultPrivacy,
      });
    });
    return () => cancelAnimationFrame(id);
  }, [settingsHydrated, settings, store.status, store.streamId]);

  const [destination, setDestination] = useState<DestinationInfo | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [activeUploadId, setActiveUploadId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Auto-clear logs when the stream returns to idle, if enabled.
  const prevStatusRef = useRef<StreamStatus>(store.status);
  useEffect(() => {
    const prev = prevStatusRef.current;
    prevStatusRef.current = store.status;
    if (
      settings.autoClearLogsOnIdle &&
      prev !== "idle" &&
      store.status === "idle" &&
      store.logs.length > 0
    ) {
      store.clearLogs();
      store.pushLog("info", "Auto-cleared previous event log.");
    }
  }, [store.status, settings.autoClearLogsOnIdle]);

  // Apply accent variant to the document root as a data attribute.
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.setAttribute("data-accent", settings.accent);
  }, [settings.accent]);

  // Fetch YouTube destination + provider info on mount.
  useEffect(() => {
    fetch("/api/youtube/destination")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: DestinationInfo | null) => {
        if (data) {
          setDestination(data);
          store.setProvider(data.provider);
          store.pushLog(
            data.provider === "mux" ? "success" : "info",
            data.provider === "mux"
              ? "Connected to Mux streaming provider."
              : "Demo mode active — set MUX_TOKEN_ID / MUX_TOKEN_SECRET for production."
          );
          if (!data.youtube.connected) {
            store.pushLog(
              "warning",
              "YOUTUBE_STREAM_KEY is not set. Configure it in Vercel env vars before going live for real."
            );
          }
        }
      })
      .catch(() => {
        /* ignore */
      });
  }, []);

  const onConfigChange = useCallback((patch: Partial<StreamConfig>) => {
    configDirtyRef.current = true;
    setConfig((cur) => ({ ...cur, ...patch }));
  }, []);

  // Block Start while the file is being uploaded.
  const isUploading = uploadProgress !== null && uploadProgress < 1;

  const handleStart = useCallback(async () => {
    if (!video) {
      store.pushLog("error", "Select a video first.");
      return;
    }
    store.pushLog("info", `Selected video: ${video.name}`);
    store.pushLog("info", "Requesting a temporary upload URL from the provider…");

    // 1) Get an upload URL.
    const upload = await requestUploadUrl();
    if (!upload) return;

    // 2) Upload the file directly to the provider (or simulate in demo mode).
    store.setStatus("uploading");
    setActiveUploadId(upload.uploadId);
    setUploadProgress(0);
    store.pushLog(
      "info",
      upload.provider === "demo"
        ? "Simulating direct upload to demo provider…"
        : `Uploading directly to provider (bypassing Vercel)…`
    );
    try {
      await uploadFile(upload, await fileFromVideo(video), (frac) =>
        setUploadProgress(frac)
      );
      setUploadProgress(1);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Upload failed";
      store.setStatus("error", msg);
      store.pushLog("error", msg);
      setUploadProgress(null);
      setActiveUploadId(null);
      return;
    }
    store.pushLog("success", "Upload complete.");
    setUploadProgress(null);

    // 3) Start the broadcast.
    await startLive({
      videoUploadId: upload.uploadId,
      title: config.title,
      description: config.description,
      loop: config.loop,
      resolution: config.resolution,
      privacy: config.privacy,
    });
  }, [video, config, requestUploadUrl, uploadFile, startLive, store]);

  const handleStop = useCallback(async () => {
    await stopLive();
  }, [stopLive]);

  const handleReset = useCallback(async () => {
    store.pushLog("info", "Resetting provider state…");
    try {
      const res = await fetch("/api/stream/reset", { method: "POST" });
      const data = await res.json();
      store.pushLog("success", data.message ?? "Reset complete.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Reset failed";
      store.pushLog("error", msg);
    }
    // Clear local stream state regardless.
    store.setStreamId(null);
    store.setStatus("idle");
    store.setStarting(false);
    store.setStopping(false);
    store.setError(null);
    setActiveUploadId(null);
    setUploadProgress(null);
  }, [store]);

  const handleSelectFile = useCallback(
    (file: File | null | undefined) => {
      // If a stream is currently active, do not allow swapping the video.
      if (store.status === "live" || store.status === "starting") {
        store.pushLog(
          "warning",
          "Cannot change video while a broadcast is active. Stop it first."
        );
        return;
      }
      selectFile(file);
      // Auto-title from the user's title template (only if not customized).
      if (file) {
        setConfig((cur) => {
          if (cur.title.trim().length > 0) return cur;
          const tmpl = settings.defaultTitleTemplate?.trim();
          if (!tmpl) return cur;
          const title = resolveTitleTemplate(tmpl, { filename: file.name });
          return { ...cur, title: title || "Untitled broadcast" };
        });
      } else {
        setConfig((cur) => ({ ...cur, title: "" }));
      }
    },
    [selectFile, store, settings.defaultTitleTemplate]
  );

  const handleClearVideo = useCallback(() => {
    if (activeUploadId) {
      store.pushLog("warning", "Cleared video selection while upload was active.");
    }
    setActiveUploadId(null);
    setUploadProgress(null);
    clear();
    // Reset the auto-generated title when the video is removed.
    setConfig((cur) => ({ ...cur, title: "" }));
  }, [activeUploadId, clear, store]);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-border/50 bg-background/80 backdrop-blur-md">
        <div className="mx-auto w-full max-w-6xl px-3 sm:px-4 lg:px-6">
          <div className="flex h-14 items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="relative flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-amber-500">
                <Youtube className="h-5 w-5 text-white" />
                <span className="absolute -inset-0.5 rounded-lg bg-primary/40 blur-md -z-10" />
              </div>
              <div className="leading-tight">
                <h1 className="text-sm font-bold text-foreground sm:text-base">
                  YouTube Live Streamer
                </h1>
                <p className="hidden text-[10px] text-muted-foreground sm:block">
                  Vercel control panel · Mobile-first
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider",
                  `pill-${store.status}`
                )}
              >
                {store.status === "live" && <span className="live-dot" />}
                {store.status}
              </span>
              {destination && (
                <span className="hidden sm:inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-[10px] font-mono text-muted-foreground">
                  {destination.provider === "mux" ? "Mux" : "Demo"}
                </span>
              )}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9 text-muted-foreground hover:text-foreground hover:bg-muted/40"
                onClick={() => setSettingsOpen(true)}
                aria-label="Open settings"
              >
                <Settings2 className="h-4 w-4" />
              </Button>
              <SettingsDialog
                open={settingsOpen}
                onOpenChange={setSettingsOpen}
                destination={destination}
              />
            </div>
          </div>
        </div>
        {store.status === "live" && (
          <div className="h-0.5 w-full shimmer" aria-hidden />
        )}
      </header>

      {/* Main grid */}
      <main className="flex-1 px-3 sm:px-4 lg:px-6 py-4 sm:py-6">
        <div className="mx-auto w-full max-w-6xl grid gap-4 lg:grid-cols-[1.1fr_1fr] lg:gap-6">
          {/* LEFT: preview + upload */}
          <section className="space-y-4">
            <Panel
              title="Video preview"
              icon={<Radio className="h-3.5 w-3.5" />}
              subtitle={video ? video.name : "No video loaded"}
            >
              <VideoPreview
                video={video}
                loop={config.loop}
                isLive={store.status === "live"}
              />
            </Panel>

            <Panel
              title="Select one local MP4 file"
              icon={<Plug className="h-3.5 w-3.5" />}
            >
              <VideoUpload
                video={video}
                error={error}
                isProbing={isProbing}
                disabled={
                  store.status === "live" ||
                  store.status === "starting" ||
                  store.status === "uploading" ||
                  isUploading
                }
                onSelectFile={handleSelectFile}
                onClear={handleClearVideo}
              />
              {uploadProgress !== null && (
                <div className="mt-3 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>
                      {uploadProgress < 1
                        ? "Uploading directly to provider…"
                        : "Upload complete"}
                    </span>
                    <span className="font-mono tabular-nums">
                      {Math.round(uploadProgress * 100)}%
                    </span>
                  </div>
                  <Progress value={uploadProgress * 100} className="h-1.5" />
                </div>
              )}
            </Panel>
          </section>

          {/* RIGHT: config + controls + status */}
          <section className="space-y-4">
            <Panel
              title="Video configuration"
              icon={<Settings2 className="h-3.5 w-3.5" />}
              subtitle={
                video
                  ? `Selected video: ${truncate(video.name, 28)}`
                  : "Select a video to configure"
              }
            >
              <StreamControls
                config={config}
                onConfigChange={onConfigChange}
                status={store.status}
                hasVideo={!!video}
                isStarting={store.isStarting}
                isStopping={store.isStopping}
                isUploading={isUploading}
                showAdvancedByDefault={settings.showAdvancedByDefault}
                onStart={handleStart}
                onStop={handleStop}
              />
            </Panel>

            <Panel
              title="YouTube destination"
              icon={<Youtube className="h-3.5 w-3.5" />}
              subtitle={
                destination?.youtube.connected
                  ? destination.youtube.channelName
                  : "Not connected"
              }
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between rounded-lg bg-muted/30 border border-border/50 px-3 py-2.5">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-lg",
                        destination?.youtube.connected
                          ? "bg-emerald-500/15 border border-emerald-500/30"
                          : "bg-destructive/15 border border-destructive/30"
                      )}
                    >
                      {destination?.youtube.connected ? (
                        <ShieldCheck className="h-4 w-4 text-emerald-400" />
                      ) : (
                        <Info className="h-4 w-4 text-destructive" />
                      )}
                    </div>
                    <div className="leading-tight">
                      <p className="text-xs font-medium text-foreground">
                        {destination?.youtube.channelName ?? "Connecting…"}
                      </p>
                      <p className="text-[10px] text-muted-foreground font-mono">
                        {destination?.youtube.connected
                          ? `Key ${destination.youtube.streamKeyPreview}`
                          : "Set YOUTUBE_STREAM_KEY in Vercel"}
                      </p>
                    </div>
                  </div>
                </div>

                <StreamStatusPanel
                  status={store.status}
                  provider={store.provider}
                  startedAt={store.startedAt}
                  uptimeSec={store.uptimeSec}
                  bytesProcessed={store.bytesProcessed}
                  lastStatusFetch={store.lastStatusFetch}
                />

                {store.error && (
                  <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive space-y-2">
                    <p>{store.error}</p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleReset}
                      className="h-7 text-[11px] gap-1.5 border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    >
                      <RotateCcw className="h-3 w-3" />
                      Reset state
                    </Button>
                  </div>
                )}
              </div>
            </Panel>

            <Panel
              title="Live event log"
              icon={<Terminal className="h-3.5 w-3.5" />}
              noBodyPad
            >
              <StreamLogs />
            </Panel>
          </section>
        </div>

        {/* Provider mode banner */}
        {destination?.provider === "demo" && (
          <div className="mx-auto mt-6 w-full max-w-6xl rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 sm:p-4">
            <div className="flex items-start gap-2.5">
              <Info className="h-4 w-4 mt-0.5 shrink-0 text-amber-400" />
              <div className="text-xs text-amber-200/90 space-y-1">
                <p className="font-semibold text-amber-100">
                  Demo mode — simulated broadcast
                </p>
                <p>
                  The dashboard is fully interactive but no real video is sent to YouTube. To go live for
                  real, set <code className="font-mono">MUX_TOKEN_ID</code>,{" "}
                  <code className="font-mono">MUX_TOKEN_SECRET</code>,{" "}
                  <code className="font-mono">YOUTUBE_STREAM_KEY</code> and{" "}
                  <code className="font-mono">YOUTUBE_CHANNEL_NAME</code> as Vercel env vars.
                </p>
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="mt-auto border-t border-border/50 bg-background/60 backdrop-blur-sm">
        <div className="mx-auto w-full max-w-6xl px-3 sm:px-4 lg:px-6 py-3 flex items-center justify-between gap-3">
          <p className="text-[10px] text-muted-foreground/70">
            Deployed on Vercel · No VPS · No permanent storage
          </p>
          {!destination && (
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground/70">
              <Loader2 className="h-3 w-3 animate-spin" />
              Connecting…
            </span>
          )}
        </div>
      </footer>
    </div>
  );
}

/* ---------- Helpers ---------- */

async function fileFromVideo(video: { objectUrl: string; name: string; type: string }): Promise<File> {
  const res = await fetch(video.objectUrl);
  const blob = await res.blob();
  return new File([blob], video.name, { type: video.type });
}

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

/* ---------- Small panel wrapper ---------- */

interface PanelProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  noBodyPad?: boolean;
}

function Panel({ title, subtitle, icon, children, noBodyPad }: PanelProps) {
  return (
    <section className="rounded-2xl glass-card overflow-hidden">
      <header className="flex items-center justify-between gap-2 border-b border-border/50 px-4 py-2.5">
        <div className="flex items-center gap-2 min-w-0">
          {icon && <span className="text-muted-foreground">{icon}</span>}
          <div className="min-w-0">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-foreground/90">
              {title}
            </h2>
            {subtitle && (
              <p className="text-[10px] text-muted-foreground truncate">{subtitle}</p>
            )}
          </div>
        </div>
      </header>
      <div className={cn(!noBodyPad && "p-4")}>{children}</div>
    </section>
  );
}
