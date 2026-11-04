"use client";

import { useCallback, useEffect, useRef } from "react";
import { useStreamStore } from "@/stores/stream-store";
import { useSettingsStore } from "@/stores/settings-store";
import type {
  StartStreamInput,
  StatusStreamResponse,
  UploadUrlResponse,
} from "@/types/stream";

interface UseStreamResult {
  /** Returns the uploadId the browser should PUT the file to (or null in demo mode). */
  requestUploadUrl: () => Promise<UploadUrlResponse | null>;
  /**
   * Performs the upload. In demo mode this is a no-op simulation. Otherwise the
   * file is PUT directly to the provider's upload URL, bypassing Vercel.
   * `onProgress` is called with the fraction 0..1.
   */
  uploadFile: (
    upload: UploadUrlResponse,
    file: File,
    onProgress?: (frac: number) => void
  ) => Promise<void>;
  /** Starts the broadcast (server creates a Live Stream + YouTube Simulcast target). */
  startLive: (input: StartStreamInput) => Promise<string | null>;
  /** Stops the broadcast. */
  stopLive: () => Promise<boolean>;
  /** Manually fetch the current status. */
  refreshStatus: () => Promise<void>;
}

export function useStream(): UseStreamResult {
  const store = useStreamStore();
  const pollIntervalSec = useSettingsStore((s) => s.pollIntervalSec);
  const pollMsRef = useRef(pollIntervalSec * 1000);
  pollMsRef.current = pollIntervalSec * 1000;


  const requestUploadUrl = useCallback(async (): Promise<UploadUrlResponse | null> => {
    try {
      const res = await fetch("/api/provider/upload-url", { method: "POST" });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`Failed to request upload URL: ${res.status} ${txt}`);
      }
      const data: UploadUrlResponse = await res.json();
      store.setProvider(data.provider);
      return data;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      store.setError(msg);
      store.pushLog("error", msg);
      return null;
    }
  }, [store]);

  const uploadFile = useCallback(
    async (
      upload: UploadUrlResponse,
      file: File,
      onProgress?: (frac: number) => void
    ): Promise<void> => {
      // In demo mode there is no real upload destination — the server simulates
      // the upload completion when /api/stream/start is called.
      if (upload.provider === "demo") {
        // Simulate progress over ~1.2s for UX.
        const total = 1200;
        const start = Date.now();
        await new Promise<void>((resolve) => {
          const tick = () => {
            const elapsed = Date.now() - start;
            const frac = Math.min(1, elapsed / total);
            onProgress?.(frac);
            if (frac >= 1) resolve();
            else requestAnimationFrame(tick);
          };
          tick();
        });
        store.pushLog("success", `Uploaded "${file.name}" to demo provider (simulated).`);
        return;
      }

      // Real provider upload: PUT directly to the provider's URL.
      // XMLHttpRequest is the only API that gives us reliable upload progress.
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open(upload.method, upload.uploadUrl, true);
        for (const [k, v] of Object.entries(upload.headers)) {
          xhr.setRequestHeader(k, v);
        }
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable && onProgress) {
            onProgress(e.loaded / e.total);
          }
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            store.pushLog("success", `Uploaded "${file.name}" to provider (${xhr.status}).`);
            resolve();
          } else {
            reject(new Error(`Upload failed: ${xhr.status} ${xhr.statusText}`));
          }
        };
        xhr.onerror = () => reject(new Error("Network error during upload."));
        xhr.send(file);
      });
    },
    [store]
  );

  const startLive = useCallback(
    async (input: StartStreamInput): Promise<string | null> => {
      store.setStarting(true);
      store.setError(null);
      store.setStatus("starting");
      store.pushLog("info", `Requesting broadcast start: "${input.title}"`);
      try {
        const res = await fetch("/api/stream/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        });
        if (!res.ok) {
          const txt = await res.text();
          throw new Error(`Start failed: ${res.status} ${txt}`);
        }
        const data = await res.json();
        store.setStreamId(data.streamId);
        store.setProvider(data.provider);
        store.setStatus(data.status, data.message);
        store.pushLog("success", data.message);
        return data.streamId as string;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        store.setStatus("error", msg);
        store.pushLog("error", msg);
        return null;
      } finally {
        store.setStarting(false);
      }
    },
    [store]
  );

  const stopLive = useCallback(async (): Promise<boolean> => {
    if (!store.streamId) {
      store.pushLog("warning", "No active stream to stop.");
      return false;
    }
    store.setStopping(true);
    store.setStatus("stopping");
    store.pushLog("info", "Stopping broadcast…");
    try {
      const res = await fetch("/api/stream/stop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ streamId: store.streamId }),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`Stop failed: ${res.status} ${txt}`);
      }
      const data = await res.json();
      store.setStatus(data.status);
      store.pushLog("success", data.message);
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      store.setStatus("error", msg);
      store.pushLog("error", msg);
      return false;
    } finally {
      store.setStopping(false);
    }
  }, [store]);

  const refreshStatus = useCallback(async (): Promise<void> => {
    if (!store.streamId) return;
    try {
      const res = await fetch(`/api/stream/status?streamId=${encodeURIComponent(store.streamId)}`);
      if (!res.ok) return;
      const data: StatusStreamResponse = await res.json();
      store.updateFromStatus(data);
    } catch {
      // Silent — polling errors shouldn't spam the UI.
    }
  }, [store]);

  // Poll status while there is an active stream.
  const streamIdRef = useRef<string | null>(store.streamId);
  streamIdRef.current = store.streamId;
  const statusRef = useRef(store.status);
  statusRef.current = store.status;

  useEffect(() => {
    if (!store.streamId) return;
    // Only poll while in a transitional or live state.
    const activeStates = ["starting", "live", "stopping", "uploading"];
    if (!activeStates.includes(store.status)) return;

    const interval = window.setInterval(() => {
      const cur = streamIdRef.current;
      const curStatus = statusRef.current;
      if (!cur) return;
      if (!activeStates.includes(curStatus)) return;
      fetch(`/api/stream/status?streamId=${encodeURIComponent(cur)}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((data: StatusStreamResponse | null) => {
          if (data) store.updateFromStatus(data);
        })
        .catch(() => {
          /* ignore transient errors */
        });
    }, pollMsRef.current);

    return () => window.clearInterval(interval);
  }, [store.streamId, store.status, store, pollIntervalSec]);

  return {
    requestUploadUrl,
    uploadFile,
    startLive,
    stopLive,
    refreshStatus,
  };
}
