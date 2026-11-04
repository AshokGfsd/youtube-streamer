"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { ResolutionPreset } from "@/types/stream";

/**
 * User-configurable dashboard settings.
 *
 * These are CLIENT-side preferences only — persisted to localStorage so they
 * survive page reloads. They do NOT include any server-side secrets
 * (Mux token / YouTube stream key) which MUST stay in Vercel env vars.
 *
 * What lives here:
 *   - Default broadcast fields (title template, description, resolution, …)
 *   - Dashboard behaviour (polling interval, log retention, auto-clear)
 *   - UI preferences (accent variant, compact logs)
 */

export type AccentVariant = "red" | "amber" | "emerald" | "violet";
export type PollIntervalSec = 3 | 5 | 10 | 15;
export type MaxLogsOption = 50 | 100 | 200 | 500;

export interface SettingsState {
  // Broadcast defaults — applied when a new video is selected / on mount.
  defaultTitleTemplate: string;
  defaultDescription: string;
  defaultResolution: ResolutionPreset;
  defaultPrivacy: "public" | "unlisted" | "private";
  defaultLoop: boolean;

  // Behavior
  pollIntervalSec: PollIntervalSec;
  maxLogs: MaxLogsOption;
  autoClearLogsOnIdle: boolean;
  autoStartPreview: boolean;

  // UI
  accent: AccentVariant;
  compactLogs: boolean;
  showAdvancedByDefault: boolean;

  // Internal — versioned so we can migrate later.
  _version: 1;
}

export interface SettingsActions {
  set: (patch: Partial<SettingsState>) => void;
  reset: () => void;
  /** Hydration flag — true once localStorage has been read. */
  _hydrated: boolean;
  _setHydrated: () => void;
}

const DEFAULTS: SettingsState = {
  defaultTitleTemplate: "{filename}",
  defaultDescription: "",
  defaultResolution: "720p",
  defaultPrivacy: "public",
  defaultLoop: true,

  pollIntervalSec: 5,
  maxLogs: 200,
  autoClearLogsOnIdle: false,
  autoStartPreview: true,

  accent: "red",
  compactLogs: false,
  showAdvancedByDefault: false,

  _version: 1,
};

const STORAGE_KEY = "yls:settings:v1";

export const useSettingsStore = create<
  SettingsState & SettingsActions
>()(
  persist(
    (set) => ({
      ...DEFAULTS,
      _hydrated: false,

      set: (patch) => set(patch),
      reset: () => set({ ...DEFAULTS }),

      _setHydrated: () => set({ _hydrated: true }),
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      version: 1,
      // Only persist data fields, not the hydrated flag.
      partialize: (s) => ({
        defaultTitleTemplate: s.defaultTitleTemplate,
        defaultDescription: s.defaultDescription,
        defaultResolution: s.defaultResolution,
        defaultPrivacy: s.defaultPrivacy,
        defaultLoop: s.defaultLoop,
        pollIntervalSec: s.pollIntervalSec,
        maxLogs: s.maxLogs,
        autoClearLogsOnIdle: s.autoClearLogsOnIdle,
        autoStartPreview: s.autoStartPreview,
        accent: s.accent,
        compactLogs: s.compactLogs,
        showAdvancedByDefault: s.showAdvancedByDefault,
        _version: s._version,
      }),
      onRehydrateStorage: () => (state) => {
        state?._setHydrated();
      },
    }
  )
);

/**
 * Resolve a title template like "{filename} — Live" against a video filename.
 * Supported tokens: {filename}, {date}, {time}, {datetime}
 */
export function resolveTitleTemplate(
  template: string,
  ctx: { filename?: string }
): string {
  const now = new Date();
  const pad = (n: number) => n.toString().padStart(2, "0");
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const time = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  const filename = ctx.filename
    ? ctx.filename.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim()
    : "";
  return (template || "")
    .replaceAll("{filename}", filename)
    .replaceAll("{date}", date)
    .replaceAll("{time}", time)
    .replaceAll("{datetime}", `${date} ${time}`)
    .trim();
}
