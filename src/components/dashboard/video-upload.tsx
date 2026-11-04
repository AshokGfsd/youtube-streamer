"use client";

import { useRef, useState, useCallback } from "react";
import { UploadCloud, FileVideo, X, Loader2, AlertCircle } from "lucide-react";
import { cn, formatBytes, formatDuration } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { VideoMeta } from "@/types/stream";

interface VideoUploadProps {
  video: VideoMeta | null;
  error: string | null;
  isProbing: boolean;
  disabled?: boolean;
  onSelectFile: (file: File | null | undefined) => void;
  onClear: () => void;
}

export function VideoUpload({
  video,
  error,
  isProbing,
  disabled,
  onSelectFile,
  onClear,
}: VideoUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const openPicker = useCallback(() => {
    if (disabled) return;
    inputRef.current?.click();
  }, [disabled]);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (disabled) return;
      const file = e.dataTransfer.files?.[0];
      onSelectFile(file);
    },
    [onSelectFile, disabled]
  );

  return (
    <div className="space-y-3">
      <input
        ref={inputRef}
        type="file"
        accept="video/mp4,video/quicktime,video/webm,video/x-matroska,.mp4,.mov,.webm,.mkv"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          onSelectFile(file);
          // Reset so the same file can be re-selected after clearing.
          e.target.value = "";
        }}
      />

      {!video ? (
        <button
          type="button"
          onClick={openPicker}
          onDragOver={(e) => {
            e.preventDefault();
            if (!disabled) setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          disabled={disabled}
          className={cn(
            "group relative w-full overflow-hidden rounded-xl border-2 border-dashed transition-all",
            "p-6 sm:p-8 text-center",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            dragOver
              ? "border-primary bg-primary/10"
              : "border-border hover:border-primary/50 hover:bg-muted/30",
            disabled && "opacity-50 cursor-not-allowed"
          )}
          aria-label="Select a local video file"
        >
          <div className="flex flex-col items-center gap-3">
            <div className="relative">
              <div className="absolute inset-0 -m-2 rounded-full bg-primary/20 blur-xl opacity-0 transition-opacity group-hover:opacity-100" />
              <div className="relative flex h-14 w-14 items-center justify-center rounded-full bg-primary/15 border border-primary/30">
                <UploadCloud className="h-6 w-6 text-primary" />
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">
                Tap to select a video
              </p>
              <p className="text-xs text-muted-foreground">
                or drop an MP4 / MOV / WebM / MKV here
              </p>
            </div>
            <p className="text-[10px] text-muted-foreground/70 mt-1">
              Max 2&nbsp;GB · never stored on the server
            </p>
          </div>
        </button>
      ) : (
        <div className="rounded-xl glass-card-strong p-4 space-y-3">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/15 border border-primary/30">
              <FileVideo className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-foreground" title={video.name}>
                {video.name}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatBytes(video.size)}
                {video.durationSec ? ` · ${formatDuration(video.durationSec)}` : ""}
                {video.width && video.height ? ` · ${video.width}×${video.height}` : ""}
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
              onClick={onClear}
              disabled={disabled}
              aria-label="Remove video"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          {isProbing && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              Reading video metadata…
            </div>
          )}
          {video.height && video.height > 0 && (
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <span className="rounded-md bg-muted px-1.5 py-0.5 font-mono">
                {video.height >= 1080 ? "1080p+" : video.height >= 720 ? "720p+" : "SD"}
              </span>
              <span className="rounded-md bg-muted px-1.5 py-0.5 font-mono uppercase">{video.type.split("/")[1] ?? "video"}</span>
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
