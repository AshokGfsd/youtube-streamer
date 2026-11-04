"use client";

import { useEffect, useRef, useState } from "react";
import { Play, Volume2, VolumeX, Maximize2 } from "lucide-react";
import type { VideoMeta } from "@/types/stream";

interface VideoPreviewProps {
  video: VideoMeta | null;
  loop: boolean;
  isLive?: boolean;
}

export function VideoPreview({ video, loop, isLive = false }: VideoPreviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);

  // Reset playback when a new video is selected.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = 0;
    if (isLive) {
      v.play().catch(() => {});
    }
  }, [video?.id, isLive]);

  // Apply the loop setting reactively.
  useEffect(() => {
    const v = videoRef.current;
    if (v) v.loop = loop;
  }, [loop]);

  if (!video) {
    return (
      <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-black/40 border border-border">
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground">
          <Play className="h-8 w-8 opacity-30" />
          <p className="text-xs">No video selected</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-border bg-black shadow-lg">
      <video
        ref={videoRef}
        src={video.objectUrl}
        className="h-full w-full object-contain"
        playsInline
        muted={muted}
        loop={loop}
        controls
        preload="metadata"
      />
      {/* Top gradient + LIVE badge */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-14 bg-gradient-to-b from-black/70 to-transparent" />
      {isLive && (
        <div className="absolute left-2 top-2 flex items-center gap-1.5 rounded-md bg-black/60 px-2 py-1 backdrop-blur-sm">
          <span className="live-dot" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-white">
            Preview · Live
          </span>
        </div>
      )}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-black/70 to-transparent" />
      <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
        <span className="pointer-events-none truncate rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white/90 max-w-[70%]">
          {video.name}
        </span>
        <div className="pointer-events-none flex items-center gap-1">
          <button
            type="button"
            className="pointer-events-auto rounded p-1 text-white/80 hover:bg-white/10 hover:text-white"
            onClick={() => {
              const v = videoRef.current;
              if (!v) return;
              v.muted = !v.muted;
              setMuted(v.muted);
            }}
            aria-label="Toggle mute"
          >
            {muted ? (
              <VolumeX className="h-4 w-4" />
            ) : (
              <Volume2 className="h-4 w-4" />
            )}
          </button>
          <button
            type="button"
            className="pointer-events-auto rounded p-1 text-white/80 hover:bg-white/10 hover:text-white"
            onClick={() => {
              const v = videoRef.current;
              if (!v) return;
              if (v.requestFullscreen) v.requestFullscreen();
            }}
            aria-label="Fullscreen"
          >
            <Maximize2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
