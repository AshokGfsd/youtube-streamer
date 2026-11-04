"use client";

import { useEffect, useState } from "react";
import {
  Settings2,
  RotateCcw,
  Save,
  SlidersHorizontal,
  Activity,
  Plug,
  Info,
  CheckCircle2,
  XCircle,
  Eye,
  EyeOff,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useSettingsStore } from "@/stores/settings-store";
import type {
  AccentVariant,
  MaxLogsOption,
  PollIntervalSec,
} from "@/stores/settings-store";
import type { ResolutionPreset } from "@/types/stream";
import { cn } from "@/lib/utils";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pre-fetched destination info so we can show read-only connection status. */
  destination: {
    youtube: {
      channelName: string;
      connected: boolean;
      streamKeyPreview: string;
    };
    provider: "mux" | "demo";
  } | null;
}

const ACCENT_OPTIONS: { value: AccentVariant; label: string; swatch: string }[] = [
  { value: "red", label: "YouTube Red", swatch: "oklch(0.62 0.22 25)" },
  { value: "amber", label: "Amber", swatch: "oklch(0.78 0.16 75)" },
  { value: "emerald", label: "Emerald", swatch: "oklch(0.65 0.18 165)" },
  { value: "violet", label: "Violet", swatch: "oklch(0.62 0.20 280)" },
];

export function SettingsDialog({
  open,
  onOpenChange,
  destination,
}: SettingsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-hidden flex flex-col gap-0 p-0">
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-border/50">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Settings2 className="h-4 w-4 text-primary" />
            Dashboard settings
          </DialogTitle>
          <DialogDescription className="text-xs">
            Configure broadcast defaults and dashboard behaviour. Stored in your
            browser&apos;s localStorage — these never leave your device.
          </DialogDescription>
        </DialogHeader>
        {/* Remount the form on each open so the draft is fresh from the store. */}
        {open ? <SettingsForm onClose={() => onOpenChange(false)} destination={destination} /> : null}
      </DialogContent>
    </Dialog>
  );
}

interface SettingsFormProps {
  onClose: () => void;
  destination: SettingsDialogProps["destination"];
}

function SettingsForm({ onClose, destination }: SettingsFormProps) {
  const settings = useSettingsStore();
  const [draft, setDraft] = useState<SettingsState>(() => ({
    defaultTitleTemplate: settings.defaultTitleTemplate,
    defaultDescription: settings.defaultDescription,
    defaultResolution: settings.defaultResolution,
    defaultPrivacy: settings.defaultPrivacy,
    defaultLoop: settings.defaultLoop,
    pollIntervalSec: settings.pollIntervalSec,
    maxLogs: settings.maxLogs,
    autoClearLogsOnIdle: settings.autoClearLogsOnIdle,
    autoStartPreview: settings.autoStartPreview,
    accent: settings.accent,
    compactLogs: settings.compactLogs,
    showAdvancedByDefault: settings.showAdvancedByDefault,
    _version: settings._version,
  }));
  const [showKey, setShowKey] = useState(false);
  const [dirty, setDirty] = useState(false);

  const patch = (p: Partial<typeof draft>) => {
    setDraft((d) => ({ ...d, ...p }));
    setDirty(true);
  };

  const handleSave = () => {
    settings.set(draft);
    setDirty(false);
    onClose();
  };

  const handleReset = () => {
    settings.reset();
    setDraft({
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
    });
    setDirty(false);
  };

  return (
    <>
      <Tabs defaultValue="defaults" className="flex-1 min-h-0 flex flex-col">
          <div className="px-5 pt-3">
            <TabsList className="h-9 w-full">
              <TabsTrigger value="defaults" className="text-xs gap-1.5">
                <SlidersHorizontal className="h-3 w-3" />
                Defaults
              </TabsTrigger>
              <TabsTrigger value="behavior" className="text-xs gap-1.5">
                <Activity className="h-3 w-3" />
                Behaviour
              </TabsTrigger>
              <TabsTrigger value="connection" className="text-xs gap-1.5">
                <Plug className="h-3 w-3" />
                Connection
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="scroll-thin overflow-y-auto px-5 py-4 flex-1">
            {/* ───────────── DEFAULTS ───────────── */}
            <TabsContent value="defaults" className="space-y-4 mt-0">
              <div className="space-y-1.5">
                <Label htmlFor="title-template" className="text-xs">
                  Title template
                </Label>
                <Input
                  id="title-template"
                  value={draft.defaultTitleTemplate}
                  onChange={(e) => patch({ defaultTitleTemplate: e.target.value })}
                  placeholder="{filename}"
                  className="bg-background/60 font-mono text-xs"
                />
                <p className="text-[10px] text-muted-foreground">
                  Tokens:{" "}
                  <code className="text-foreground/80">{`{filename}`}</code>{" "}
                  <code className="text-foreground/80">{`{date}`}</code>{" "}
                  <code className="text-foreground/80">{`{time}`}</code>{" "}
                  <code className="text-foreground/80">{`{datetime}`}</code>
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="default-description" className="text-xs">
                  Default description
                </Label>
                <Textarea
                  id="default-description"
                  value={draft.defaultDescription}
                  onChange={(e) => patch({ defaultDescription: e.target.value })}
                  placeholder="Pre-filled into every new broadcast."
                  rows={3}
                  className="bg-background/60 resize-none scroll-thin text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Default resolution</Label>
                  <Select
                    value={draft.defaultResolution}
                    onValueChange={(v) =>
                      patch({ defaultResolution: v as ResolutionPreset })
                    }
                  >
                    <SelectTrigger className="bg-background/60 text-xs">
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
                  <Label className="text-xs">Default privacy</Label>
                  <Select
                    value={draft.defaultPrivacy}
                    onValueChange={(v) =>
                      patch({
                        defaultPrivacy: v as "public" | "unlisted" | "private",
                      })
                    }
                  >
                    <SelectTrigger className="bg-background/60 text-xs">
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

              <SettingRow
                label="Loop playback by default"
                description="Restart the video from the beginning when it ends."
              >
                <Switch
                  checked={draft.defaultLoop}
                  onCheckedChange={(v) => patch({ defaultLoop: v })}
                  aria-label="Default loop"
                />
              </SettingRow>

              <SettingRow
                label="Show advanced settings by default"
                description="Auto-expand the advanced section in the controls."
              >
                <Switch
                  checked={draft.showAdvancedByDefault}
                  onCheckedChange={(v) => patch({ showAdvancedByDefault: v })}
                  aria-label="Show advanced by default"
                />
              </SettingRow>
            </TabsContent>

            {/* ───────────── BEHAVIOUR ───────────── */}
            <TabsContent value="behavior" className="space-y-4 mt-0">
              <div className="space-y-1.5">
                <Label className="text-xs">Status polling interval</Label>
                <Select
                  value={String(draft.pollIntervalSec)}
                  onValueChange={(v) =>
                    patch({ pollIntervalSec: Number(v) as PollIntervalSec })
                  }
                >
                  <SelectTrigger className="bg-background/60 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="3">Every 3 seconds</SelectItem>
                    <SelectItem value="5">Every 5 seconds (default)</SelectItem>
                    <SelectItem value="10">Every 10 seconds</SelectItem>
                    <SelectItem value="15">Every 15 seconds</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-muted-foreground">
                  How often the dashboard polls <code>/api/stream/status</code>{" "}
                  while a broadcast is active.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Event log capacity</Label>
                <Select
                  value={String(draft.maxLogs)}
                  onValueChange={(v) =>
                    patch({ maxLogs: Number(v) as MaxLogsOption })
                  }
                >
                  <SelectTrigger className="bg-background/60 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="50">50 entries</SelectItem>
                    <SelectItem value="100">100 entries</SelectItem>
                    <SelectItem value="200">200 entries (default)</SelectItem>
                    <SelectItem value="500">500 entries</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <SettingRow
                label="Auto-clear logs when idle"
                description="Wipe the event log when the stream returns to idle."
              >
                <Switch
                  checked={draft.autoClearLogsOnIdle}
                  onCheckedChange={(v) => patch({ autoClearLogsOnIdle: v })}
                  aria-label="Auto-clear logs on idle"
                />
              </SettingRow>

              <SettingRow
                label="Auto-start preview playback"
                description="Begin previewing the video as soon as it is selected."
              >
                <Switch
                  checked={draft.autoStartPreview}
                  onCheckedChange={(v) => patch({ autoStartPreview: v })}
                  aria-label="Auto-start preview"
                />
              </SettingRow>

              <SettingRow
                label="Compact log entries"
                description="Tighter row spacing in the event log panel."
              >
                <Switch
                  checked={draft.compactLogs}
                  onCheckedChange={(v) => patch({ compactLogs: v })}
                  aria-label="Compact logs"
                />
              </SettingRow>

              <Separator className="bg-border/50" />

              <div className="space-y-1.5">
                <Label className="text-xs">Accent colour</Label>
                <div className="grid grid-cols-4 gap-2">
                  {ACCENT_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => patch({ accent: opt.value })}
                      className={cn(
                        "group relative flex flex-col items-center gap-1.5 rounded-lg border p-2 transition-all",
                        draft.accent === opt.value
                          ? "border-foreground/30 bg-muted/40"
                          : "border-border/50 hover:border-border hover:bg-muted/20"
                      )}
                      aria-pressed={draft.accent === opt.value}
                    >
                      <span
                        className="h-5 w-5 rounded-full ring-2 ring-offset-2 ring-offset-background"
                        style={{
                          backgroundColor: opt.swatch,
                          boxShadow: `0 0 10px ${opt.swatch}`,
                          // @ts-expect-error custom property for CSS variable
                          "--ring-color": opt.swatch,
                        }}
                      />
                      <span className="text-[10px] text-muted-foreground text-center leading-tight">
                        {opt.label}
                      </span>
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Replaces the YouTube-red accents across the dashboard. (Cosmetic only.)
                </p>
              </div>
            </TabsContent>

            {/* ───────────── CONNECTION ───────────── */}
            <TabsContent value="connection" className="space-y-3 mt-0">
              <div className="rounded-lg border border-border/50 bg-muted/20 p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-foreground">
                    Streaming provider
                  </span>
                  <Badge
                    variant="outline"
                    className={cn(
                      "font-mono text-[10px]",
                      destination?.provider === "mux"
                        ? "border-emerald-500/40 text-emerald-300 bg-emerald-500/10"
                        : "border-amber-500/40 text-amber-300 bg-amber-500/10"
                    )}
                  >
                    {destination?.provider === "mux" ? "MUX" : "DEMO"}
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {destination?.provider === "mux"
                    ? "Mux credentials detected in server env vars. Direct uploads + real Live Stream API calls are active."
                    : "No Mux credentials found. The dashboard runs in fully simulated demo mode. Set MUX_TOKEN_ID and MUX_TOKEN_SECRET in Vercel env vars to switch to production."}
                </p>
              </div>

              <div className="rounded-lg border border-border/50 bg-muted/20 p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-foreground">
                    YouTube destination
                  </span>
                  {destination?.youtube.connected ? (
                    <Badge
                      variant="outline"
                      className="border-emerald-500/40 text-emerald-300 bg-emerald-500/10 font-mono text-[10px]"
                    >
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Connected
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="border-destructive/40 text-destructive bg-destructive/10 font-mono text-[10px]"
                    >
                      <XCircle className="h-3 w-3 mr-1" />
                      Not configured
                    </Badge>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="channel-name" className="text-xs">
                    Channel name (display only)
                  </Label>
                  <Input
                    id="channel-name"
                    value={destination?.youtube.channelName ?? "Connecting…"}
                    readOnly
                    className="bg-background/40 text-xs font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="stream-key" className="text-xs">
                    Stream key (server-side, masked)
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      id="stream-key"
                      type={showKey && destination?.youtube.connected ? "text" : "text"}
                      value={
                        destination?.youtube.connected
                          ? destination.youtube.streamKeyPreview
                          : "Not configured"
                      }
                      readOnly
                      className={cn(
                        "bg-background/40 text-xs font-mono flex-1",
                        !destination?.youtube.connected && "text-muted-foreground"
                      )}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-8 w-9 shrink-0"
                      onClick={() => setShowKey((v) => !v)}
                      disabled={!destination?.youtube.connected}
                      aria-label={showKey ? "Hide stream key" : "Show stream key"}
                    >
                      {showKey ? (
                        <EyeOff className="h-3.5 w-3.5" />
                      ) : (
                        <Eye className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    Only the masked preview is shown to the browser. The full key
                    lives in the <code>YOUTUBE_STREAM_KEY</code> Vercel env var and
                    is never sent to the client.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2 rounded-lg border border-blue-500/30 bg-blue-500/10 p-3 text-[11px] text-blue-200/90">
                <Info className="h-3.5 w-3.5 mt-0.5 shrink-0 text-blue-300" />
                <div>
                  <p className="font-semibold text-blue-100 mb-1">
                    Why can&apos;t I edit credentials here?
                  </p>
                  <p>
                    Credentials must be readable by the Vercel server functions,
                    so they live in Vercel env vars — not in your browser. Storing
                    them in localStorage would expose them to anyone using this
                    browser and the server wouldn&apos;t be able to read them either.
                  </p>
                </div>
              </div>
            </TabsContent>
          </div>
        </Tabs>

        <DialogFooter className="px-5 py-3 border-t border-border/50 flex-row items-center justify-between gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleReset}
            className="text-xs gap-1.5 text-muted-foreground hover:text-destructive"
          >
            <RotateCcw className="h-3 w-3" />
            Reset to defaults
          </Button>
          <div className="flex items-center gap-2">
            {dirty && (
              <span className="text-[10px] text-amber-300/80">Unsaved changes</span>
            )}
            <Button
              type="button"
              size="sm"
              onClick={handleSave}
              disabled={!dirty}
              className="gap-1.5 text-xs"
            >
              <Save className="h-3 w-3" />
              Save
            </Button>
          </div>
        </DialogFooter>
    </>
  );
}

function SettingRow({
  label,
  description,
  children,
}: {
  label: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-muted/20 border border-border/50 px-3 py-2.5">
      <div className="min-w-0">
        <p className="text-xs font-medium text-foreground">{label}</p>
        <p className="text-[10px] text-muted-foreground">{description}</p>
      </div>
      {children}
    </div>
  );
}
