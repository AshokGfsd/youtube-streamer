"use client";

import { useEffect, useState } from "react";
import {
  Circle,
  Loader2,
  Radio,
  Square,
  UploadCloud,
  AlertTriangle,
  Power,
} from "lucide-react";
import { cn, formatBytes, formatDuration, formatTime } from "@/lib/utils";
import type { StreamStatus as Status } from "@/types/stream";

interface StreamStatusProps {
  status: Status;
  provider: "mux" | "demo" | "unknown";
  startedAt: number | null;
  uptimeSec: number | null;
  bytesProcessed: number | null;
  lastStatusFetch: number | null;
}

const STATUS_LABEL: Record<Status, string> = {
  idle: "Idle",
  uploading: "Uploading",
  starting: "Starting",
  live: "Live",
  stopping: "Stopping",
  error: "Error",
};

const STATUS_ICON: Record<Status, React.ReactNode> = {
  idle: <Circle className="h-3.5 w-3.5" />,
  uploading: <UploadCloud className="h-3.5 w-3.5" />,
  starting: <Loader2 className="h-3.5 w-3.5 animate-spin" />,
  live: <Radio className="h-3.5 w-3.5" />,
  stopping: <Power className="h-3.5 w-3.5" />,
  error: <AlertTriangle className="h-3.5 w-3.5" />,
};

export function StreamStatus({
  status,
  provider,
  startedAt,
  uptimeSec,
  bytesProcessed,
  lastStatusFetch,
}: StreamStatusProps) {
  // Force a re-render every second while live so uptime ticks.
  const [, setTick] = useState(0);
  useEffect(() => {
    if (status !== "live") return;
    const id = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, [status]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider",
              `pill-${status}`
            )}
          >
            {STATUS_ICON[status]}
            {STATUS_LABEL[status]}
          </span>
          {status === "live" && (
            <span className="flex h-4 items-end gap-0.5" aria-hidden>
              <span className="eq-bar h-3" />
              <span className="eq-bar h-4" />
              <span className="eq-bar h-2" />
              <span className="eq-bar h-3" />
              <span className="eq-bar h-2" />
            </span>
          )}
        </div>
        <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-mono uppercase text-muted-foreground">
          {provider === "mux" ? (
            "Provider · Mux"
          ) : provider === "demo" ? (
            "Provider · Demo"
          ) : (
            "Provider · —"
          )}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Stat
          label="Uptime"
          value={status === "live" ? formatDuration(uptimeSec) : "—"}
          icon={<Radio className="h-3 w-3" />}
        />
        <Stat
          label="Bytes sent"
          value={bytesProcessed != null ? formatBytes(bytesProcessed) : "—"}
          icon={<UploadCloud className="h-3 w-3" />}
        />
        <Stat
          label="Started"
          value={startedAt ? formatTime(startedAt) : "—"}
          icon={<Circle className="h-3 w-3" />}
        />
      </div>

      {lastStatusFetch && (
        <p className="text-[10px] text-muted-foreground/60">
          Last sync {formatTime(lastStatusFetch)}
          {status === "live" && (
            <Square className="ml-1 inline h-2 w-2 fill-current" />
          )}
        </p>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-lg bg-muted/30 border border-border/50 px-2.5 py-2">
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
        {icon}
        {label}
      </div>
      <p className="mt-1 font-mono text-sm font-semibold text-foreground tabular-nums">
        {value}
      </p>
    </div>
  );
}
