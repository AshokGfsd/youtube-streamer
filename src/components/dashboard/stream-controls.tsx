"use client";

import { useCallback, useMemo, useState } from "react";
import {
  Radio,
  Square,
  Loader2,
  Settings2,
  RefreshCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { ResolutionPreset, StreamConfig, StreamStatus } from "@/types/stream";

interface StreamControlsProps {
  config: StreamConfig;
  onConfigChange: (patch: Partial<StreamConfig>) => void;
  status: StreamStatus;
  hasVideo: boolean;
  isStarting: boolean;
  isStopping: boolean;
  isUploading: boolean;
  showAdvancedByDefault?: boolean;
  onStart: () => void;
  onStop: () => void;
}

export function StreamControls({
  config,
  onConfigChange,
  status,
  hasVideo,
  isStarting,
  isStopping,
  isUploading,
  showAdvancedByDefault = false,
  onStart,
  onStop,
}: StreamControlsProps) {
  const [showAdvanced, setShowAdvanced] = useState(showAdvancedByDefault);

  const canStart = useMemo(() => {
    if (!hasVideo) return false;
    if (isStarting || isUploading) return false;
    const blocked: StreamStatus[] = ["live", "starting", "stopping", "uploading"];
    return !blocked.includes(status);
  }, [hasVideo, isStarting, isUploading, status]);

  const canStop = useMemo(() => {
    if (isStopping) return false;
    return ["live", "starting", "error"].includes(status);
  }, [isStopping, status]);

  const start = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!canStart) return;
      onStart();
    },
    [canStart, onStart]
  );

  return (
    <form onSubmit={start} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="title" className="text-xs font-medium text-muted-foreground">
          Broadcast title
        </Label>
        <Input
          id="title"
          value={config.title}
          onChange={(e) => onConfigChange({ title: e.target.value })}
          placeholder="My Live Stream"
          maxLength={100}
          className="bg-background/60"
          disabled={isStarting || isUploading}
          required
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="description" className="text-xs font-medium text-muted-foreground">
          Description <span className="text-muted-foreground/60">(optional)</span>
        </Label>
        <Textarea
          id="description"
          value={config.description}
          onChange={(e) => onConfigChange({ description: e.target.value })}
          placeholder="Tell viewers what this stream is about…"
          rows={3}
          maxLength={5000}
          className="bg-background/60 resize-none scroll-thin"
          disabled={isStarting || isUploading}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="resolution" className="text-xs font-medium text-muted-foreground">
            Resolution
          </Label>
          <Select
            value={config.resolution}
            onValueChange={(v) => onConfigChange({ resolution: v as ResolutionPreset })}
            disabled={isStarting || isUploading}
          >
            <SelectTrigger id="resolution" className="bg-background/60">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="480p">480p · SD</SelectItem>
              <SelectItem value="720p">720p · HD</SelectItem>
              <SelectItem value="1080p">1080p · Full HD</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="privacy" className="text-xs font-medium text-muted-foreground">
            Privacy
          </Label>
          <Select
            value={config.privacy}
            onValueChange={(v) =>
              onConfigChange({ privacy: v as StreamConfig["privacy"] })
            }
            disabled={isStarting || isUploading}
          >
            <SelectTrigger id="privacy" className="bg-background/60">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="public">Public</SelectItem>
              <SelectItem value="unlisted">Unlisted</SelectItem>
              <SelectItem value="private">Private</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex items-center justify-between rounded-lg bg-muted/30 border border-border/50 px-3 py-2.5">
        <div>
          <p className="text-xs font-medium text-foreground">Loop playback</p>
          <p className="text-[10px] text-muted-foreground">
            Restart from the beginning when the video ends
          </p>
        </div>
        <Switch
          checked={config.loop}
          onCheckedChange={(v) => onConfigChange({ loop: v })}
          disabled={isStarting || isUploading}
          aria-label="Toggle loop playback"
        />
      </div>

      <button
        type="button"
        onClick={() => setShowAdvanced((v) => !v)}
        className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
      >
        <Settings2 className="h-3 w-3" />
        {showAdvanced ? "Hide advanced" : "Show advanced"}
        <RefreshCcw className={cn("h-3 w-3 transition-transform", showAdvanced && "rotate-90")} />
      </button>

      {showAdvanced && (
        <div className="rounded-lg border border-border/50 bg-muted/20 p-3 text-[11px] text-muted-foreground space-y-1">
          <p>
            <span className="font-mono text-foreground/80">RTMPS destination:</span>{" "}
            rtmps://a.rtmp.youtube.com/live2/&lt;stream-key&gt;
          </p>
          <p>
            The stream key is read from a Vercel env var and is never exposed to the browser.
          </p>
          <p>
            Vercel routes only the start/stop/status requests — your video file goes directly to the
            streaming provider, never through the Next.js function body.
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 pt-1">
        <Button
          type="submit"
          disabled={!canStart}
          className={cn(
            "h-11 gap-2 text-sm font-bold uppercase tracking-wide",
            "bg-primary text-primary-foreground hover:bg-primary/90",
            canStart && "btn-glow"
          )}
        >
          {isStarting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Radio className="h-4 w-4" />
          )}
          {isStarting ? "Starting…" : "Start Live"}
        </Button>
        <Button
          type="button"
          variant="destructive"
          onClick={onStop}
          disabled={!canStop}
          className="h-11 gap-2 text-sm font-bold uppercase tracking-wide"
        >
          {isStopping ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Square className="h-4 w-4 fill-current" />
          )}
          {isStopping ? "Stopping…" : "Stop Live"}
        </Button>
      </div>
    </form>
  );
}
