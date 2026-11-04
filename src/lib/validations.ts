import { z } from "zod";

// Max local file size: 2 GB. The browser uploads DIRECTLY to the streaming
// provider, never to Vercel, so this is just a sanity guard, not a body limit.
export const MAX_FILE_BYTES = 2 * 1024 * 1024 * 1024;

export const ACCEPTED_MIME = [
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "video/x-matroska",
] as const;

export const videoFileSchema = z
  .object({
    name: z.string().min(1),
    size: z.number().positive().max(MAX_FILE_BYTES),
    type: z.string(),
  })
  .refine((f) => ACCEPTED_MIME.includes(f.type as (typeof ACCEPTED_MIME)[number]), {
    message: "Unsupported file type. Use MP4, MOV, WebM, or MKV.",
  })
  .refine((f) => f.size <= MAX_FILE_BYTES, {
    message: "File exceeds the 2 GB limit.",
  });

export const startStreamSchema = z.object({
  videoUploadId: z.string().min(1, "Missing upload id"),
  title: z.string().min(3, "Title must be at least 3 characters").max(100),
  description: z.string().max(5000).optional().default(""),
  loop: z.boolean().default(true),
  resolution: z.enum(["480p", "720p", "1080p"]).default("720p"),
  privacy: z.enum(["public", "unlisted", "private"]).default("public"),
});

export type StartStreamInput = z.infer<typeof startStreamSchema>;
