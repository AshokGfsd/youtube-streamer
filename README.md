# YouTube Live Streamer

A mobile-first Next.js dashboard that broadcasts a **single local video file** to **YouTube Live** via a cloud streaming provider (Mux), deployed entirely on **Vercel** — no VPS, no separate backend, no permanent video storage.

## Architecture

```
┌─────────────┐      ┌──────────────────┐      ┌──────────────────────┐
│ Mobile      │─────▶│ Next.js dashboard│─────▶│ Vercel Route Handler  │
│ browser     │      │ (this app)       │      │ /api/provider/upload- │
└──────┬──────┘      └──────────────────┘      │ url                   │
       │                                        └──────────┬─────────────┘
       │ 1. Picks a local MP4                              │
       │ 2. PUTs file DIRECTLY to provider (bypasses       │ returns
       │    Vercel's request body limit)                   ▼ upload URL
       │                                        ┌──────────────────────┐
       │                                        │ Cloud streaming      │
       │                                        │ provider (Mux)       │
       │                                        │  - Direct Upload     │
       │                                        │  - Live Stream +     │
       │                                        │    Simulcast target  │
       │                                        └──────────┬───────────┘
       │                                                   │ RTMPS push
       │                                                   ▼
       │                                        ┌──────────────────────┐
       └────────────────────────────────────────│ YouTube Live         │
                                                └──────────────────────┘
```

The browser uploads the video file **directly to Mux** using a temporary pre-signed URL — the file never enters Vercel's request body. Vercel only sees the small JSON control requests (`/api/stream/start`, `/api/stream/stop`, `/api/stream/status`).

> **Important architectural constraint**: Mux's Live Stream API expects an RTMP push from an encoder. On Vercel alone you cannot run a persistent FFmpeg process. To actually broadcast a pre-recorded file to YouTube you need a tiny external worker (Railway / Render / Fly.io micro-container) that pulls the uploaded Mux asset and pushes it to the Mux Live Stream RTMP endpoint. This app does NOT include that worker — it implements the full **control plane** and a **demo mode** so the UX is fully demonstrable without external infrastructure.

## Demo mode

If `MUX_TOKEN_ID` and `MUX_TOKEN_SECRET` are not set, the app automatically falls back to **demo mode**:

- The upload URL is a `demo://` URL — the browser simulates upload progress without sending bytes.
- `/api/stream/start` creates an in-memory stream record and simulates the lifecycle (`starting → live → stopping → idle`).
- The dashboard is fully interactive: select a video, click **Start Live**, watch the status transition, click **Stop Live**.
- No data leaves the server, no real broadcast is sent to YouTube.

Demo mode is perfect for evaluating the UX before plugging in real credentials.

## Production setup (Mux + YouTube)

1. **Create a Mux account** at https://www.mux.com.
2. **Create an API access token** with `Video` read/write permissions.
3. **Get a YouTube stream key** from YouTube Studio → Create → Go Live → Stream.
4. **Set Vercel env vars**:
   ```
   MUX_TOKEN_ID=...
   MUX_TOKEN_SECRET=...
   YOUTUBE_STREAM_KEY=...
   YOUTUBE_CHANNEL_NAME=My Channel
   NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
   ```
5. **Deploy an external encoder worker** that:
   - Receives the Mux Live Stream ID (via Vercel webhook or polling)
   - Pulls the Mux Asset playback URL
   - Runs FFmpeg to push it to `mux_rtmp_url` with `mux_stream_key`
   - The Mux Live Stream's Simulcast target then forwards to `rtmps://a.rtmp.youtube.com/live2/<stream-key>`

## Local development

```bash
bun install
bun run dev
```

Open the preview at the URL Vercel assigns (or the local sandbox preview panel — `localhost:3000` is not directly accessible from your machine).

## Tech stack

| Layer            | Technology                          |
| ---------------- | ----------------------------------- |
| Framework        | Next.js 16 (App Router)             |
| Language         | TypeScript 5                        |
| Styling          | Tailwind CSS 4                      |
| UI components    | shadcn/ui (New York)                |
| Icons            | Lucide React                        |
| Video preview    | HTML5 `<video>` + object URL        |
| Client state     | Zustand                             |
| Server API       | Next.js Route Handlers              |
| Hosting          | Vercel                              |
| Live broadcast   | Mux Direct Upload + Live Stream API |
| Live destination | YouTube RTMPS                       |

## API surface

| Endpoint                   | Method | Purpose                                              |
| -------------------------- | ------ | ---------------------------------------------------- |
| `/api/provider/upload-url` | POST   | Request a temporary direct-upload URL               |
| `/api/stream/start`        | POST   | Start the broadcast (creates Mux Live Stream)       |
| `/api/stream/stop`         | POST   | Stop the broadcast (disables the Mux Live Stream)   |
| `/api/stream/status`       | GET    | Poll the current stream status                       |
| `/api/stream/reset`        | POST   | Forcibly clear all in-memory demo streams (demo only) |
| `/api/provider/webhook`    | POST   | Receive Mux webhook events                          |
| `/api/youtube/destination` | GET    | Safe-to-expose YouTube metadata + provider mode     |

## Dashboard settings popup

Click the **gear icon** in the top-right of the header to open the settings dialog. All preferences are persisted to `localStorage` (key: `yls:settings:v1`) and survive page reloads. They never leave your browser.

**Defaults tab**
- Title template — supports `{filename}`, `{date}`, `{time}`, `{datetime}` tokens (e.g. `{filename} — Live`)
- Default description, resolution, privacy, loop toggle
- Show advanced settings expanded by default

**Behaviour tab**
- Status polling interval (3 / 5 / 10 / 15 seconds)
- Event log capacity (50 / 100 / 200 / 500 entries)
- Auto-clear logs when the stream returns to idle
- Auto-start preview playback on video selection
- Compact log row spacing
- Accent colour (YouTube Red / Amber / Emerald / Violet) — applies live via `[data-accent]` on `<html>`

**Connection tab** (read-only)
- Streaming provider mode (Mux or Demo)
- YouTube channel name + masked stream key preview
- Show/hide the masked stream key preview
- Explanation of why credentials must stay in Vercel env vars (not localStorage)

> **Note on credentials**: Mux tokens and the YouTube stream key are server-side secrets and CANNOT be stored in localStorage — the Vercel Route Handlers need to read them on the server. The settings popup only manages client-side preferences; the Connection tab is a read-only view of the server's env-var state.

## Project structure

```
src/
├── app/
│   ├── api/
│   │   ├── stream/{start,stop,status,reset}/route.ts
│   │   ├── provider/{upload-url,webhook}/route.ts
│   │   └── youtube/destination/route.ts
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── dashboard/
│   │   ├── stream-dashboard.tsx
│   │   ├── video-upload.tsx
│   │   ├── video-preview.tsx
│   │   ├── stream-controls.tsx
│   │   ├── stream-status.tsx
│   │   ├── stream-logs.tsx
│   │   └── settings-dialog.tsx     (popup, persisted to localStorage)
│   └── ui/  (shadcn)
├── hooks/
│   ├── use-video.ts
│   └── use-stream.ts
├── services/
│   ├── streaming-provider.ts   (server-only, Mux + demo + resetAll)
│   └── youtube.ts               (server-only, stream key access)
├── stores/
│   ├── stream-store.ts          (Zustand, runtime stream state)
│   └── settings-store.ts        (Zustand + persist → localStorage)
├── types/
│   └── stream.ts
└── lib/
    ├── validations.ts           (zod schemas)
    └── utils.ts
```

## Vercel limitations explicitly handled

| Requirement                                    | Vercel-only feasibility                       |
| ---------------------------------------------- | --------------------------------------------- |
| Next.js dashboard                              | ✅ Yes                                         |
| Local video preview                            | ✅ Yes                                         |
| Upload UI                                      | ✅ Yes                                         |
| Temporary upload without permanent app storage | ✅ Yes — direct browser → provider upload      |
| Start / stop controls                          | ✅ Yes — short-lived route handlers            |
| Stream status polling                          | ✅ Yes — GET every 5 s                         |
| Persistent FFmpeg process                      | ❌ No — needs external worker                  |
| Indefinite background streaming                | ❌ No — needs external encoder                 |
| 24/7 stream while mobile is off                | ❌ No — needs external encoder                 |

## License

MIT — use this as a starting point for your own live-streaming control panel.
