"use client";

import { create } from "zustand";
import type {
  LogEntry,
  LogLevel,
  StreamStatus,
  StreamStoreState,
} from "@/types/stream";
import { makeId } from "@/lib/utils";
import { useSettingsStore } from "@/stores/settings-store";

interface StreamStoreActions {
  setStatus: (status: StreamStatus, message?: string) => void;
  setProvider: (provider: StreamStoreState["provider"]) => void;
  setStreamId: (id: string | null) => void;
  setStarting: (v: boolean) => void;
  setStopping: (v: boolean) => void;
  setError: (err: string | null) => void;
  updateFromStatus: (s: {
    streamId: string | null;
    status: StreamStatus;
    startedAt: number | null;
    uptimeSec: number | null;
    bytesProcessed: number | null;
    provider: "mux" | "demo";
  }) => void;
  pushLog: (level: LogLevel, message: string) => void;
  clearLogs: () => void;
  reset: () => void;
}

const FALLBACK_MAX_LOGS = 200;

const initialState: StreamStoreState = {
  status: "idle",
  provider: "unknown",
  streamId: null,
  startedAt: null,
  uptimeSec: null,
  bytesProcessed: null,
  lastStatusFetch: null,
  logs: [],
  isStarting: false,
  isStopping: false,
  error: null,
};

export const useStreamStore = create<
  StreamStoreState & StreamStoreActions
>((set) => ({
  ...initialState,

  setStatus: (status, message) =>
    set((s) => ({
      status,
      error: status === "error" ? message ?? s.error : null,
    })),

  setProvider: (provider) => set({ provider }),

  setStreamId: (streamId) => set({ streamId }),

  setStarting: (isStarting) => set({ isStarting }),
  setStopping: (isStopping) => set({ isStopping }),

  setError: (error) => set({ error }),

  updateFromStatus: (s) =>
    set({
      streamId: s.streamId,
      status: s.status,
      startedAt: s.startedAt,
      uptimeSec: s.uptimeSec,
      bytesProcessed: s.bytesProcessed,
      provider: s.provider,
      lastStatusFetch: Date.now(),
    }),

  pushLog: (level, message) =>
    set((s) => {
      // Read the user-configurable max logs from the settings store.
      // If the settings store hasn't hydrated yet, fall back to a sane default.
      let maxLogs: number = FALLBACK_MAX_LOGS;
      try {
        const settingsState = useSettingsStore.getState();
        if (settingsState && typeof settingsState.maxLogs === "number") {
          maxLogs = settingsState.maxLogs;
        }
      } catch {
        /* settings store not ready — keep fallback */
      }
      const entry: LogEntry = {
        id: makeId("log"),
        ts: Date.now(),
        level,
        message,
      };
      const logs = [entry, ...s.logs].slice(0, maxLogs);
      return { logs };
    }),

  clearLogs: () => set({ logs: [] }),

  reset: () => set({ ...initialState, logs: [] }),
}));
