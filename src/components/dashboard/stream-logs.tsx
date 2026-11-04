"use client";

import { useEffect, useRef } from "react";
import { Info, CheckCircle2, AlertTriangle, XCircle, Trash2, ScrollText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, formatTime } from "@/lib/utils";
import { useStreamStore } from "@/stores/stream-store";
import type { LogLevel } from "@/types/stream";

const LEVEL_ICON: Record<LogLevel, React.ReactNode> = {
  info: <Info className="h-3 w-3 text-muted-foreground" />,
  success: <CheckCircle2 className="h-3 w-3 text-emerald-400" />,
  warning: <AlertTriangle className="h-3 w-3 text-amber-400" />,
  error: <XCircle className="h-3 w-3 text-destructive" />,
};

const LEVEL_TEXT: Record<LogLevel, string> = {
  info: "text-muted-foreground",
  success: "text-foreground",
  warning: "text-amber-300",
  error: "text-destructive",
};

export function StreamLogs() {
  const logs = useStreamStore((s) => s.logs);
  const clearLogs = useStreamStore((s) => s.clearLogs);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Newest entry is at the top, so no auto-scroll needed.
  // But we DO want to flash a subtle border when a new log arrives.
  useEffect(() => {
    if (!scrollRef.current || logs.length === 0) return;
    scrollRef.current.animate(
      [{ borderColor: "transparent" }, { borderColor: "rgb(255 0 51 / 0.4)" }, { borderColor: "transparent" }],
      { duration: 600, easing: "ease-out" }
    );
  }, [logs]);

  return (
    <div className="flex h-full flex-col rounded-xl glass-card overflow-hidden">
      <div className="flex items-center justify-between border-b border-border/50 px-3 py-2">
        <div className="flex items-center gap-2">
          <ScrollText className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Event log
          </span>
          {logs.length > 0 && (
            <span className="rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-mono text-muted-foreground">
              {logs.length}
            </span>
          )}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-muted-foreground hover:text-destructive"
          onClick={clearLogs}
          disabled={logs.length === 0}
          aria-label="Clear logs"
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
      <div
        ref={scrollRef}
        className="scroll-thin max-h-72 min-h-[120px] flex-1 overflow-y-auto px-2 py-2"
        role="log"
        aria-live="polite"
        aria-label="Stream event log"
      >
        {logs.length === 0 ? (
          <div className="flex h-full min-h-[100px] items-center justify-center text-[11px] text-muted-foreground/60">
            No events yet. Select a video and click Start Live.
          </div>
        ) : (
          <ul className="space-y-1">
            {logs.map((log) => (
              <li
                key={log.id}
                className="flex items-start gap-2 rounded-md px-1.5 py-1 hover:bg-muted/30"
              >
                <span className="mt-0.5 shrink-0">
                  {LEVEL_ICON[log.level]}
                </span>
                <span className="shrink-0 font-mono text-[10px] text-muted-foreground/70 tabular-nums">
                  {formatTime(log.ts)}
                </span>
                <span
                  className={cn(
                    "min-w-0 flex-1 text-[11px] leading-relaxed break-words",
                    LEVEL_TEXT[log.level]
                  )}
                >
                  {log.message}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
