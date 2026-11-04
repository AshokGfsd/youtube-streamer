"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { videoFileSchema } from "@/lib/validations";
import type { VideoMeta } from "@/types/stream";
import { makeId } from "@/lib/utils";

interface UseVideoResult {
  video: VideoMeta | null;
  error: string | null;
  isProbing: boolean;
  selectFile: (file: File | null | undefined) => string | null;
  clear: () => void;
}

/**
 * Manages a single selected local video file:
 *   - validates MIME + size
 *   - creates a browser object URL for preview
 *   - probes duration / dimensions via a hidden HTML5 video element
 *   - releases the object URL on clear/unmount
 *
 * No permanent storage — the file lives only in browser memory.
 */
export function useVideo(): UseVideoResult {
  const [video, setVideo] = useState<VideoMeta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isProbing, setIsProbing] = useState(false);
  const objectUrlRef = useRef<string | null>(null);
  const probeElRef = useRef<HTMLVideoElement | null>(null);

  const releaseObjectUrl = useCallback(() => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  }, []);

  const clear = useCallback(() => {
    releaseObjectUrl();
    setVideo(null);
    setError(null);
    setIsProbing(false);
  }, [releaseObjectUrl]);

  const probeVideo = useCallback(
    (objectUrl: string): Promise<{ durationSec: number; width: number; height: number }> => {
      return new Promise((resolve, reject) => {
        const v = document.createElement("video");
        v.preload = "metadata";
        v.muted = true;
        v.src = objectUrl;
        probeElRef.current = v;

        const cleanup = () => {
          v.removeAttribute("src");
          v.load();
          probeElRef.current = null;
        };

        v.onloadedmetadata = () => {
          const result = {
            durationSec: Number.isFinite(v.duration) ? v.duration : 0,
            width: v.videoWidth || 0,
            height: v.videoHeight || 0,
          };
          cleanup();
          resolve(result);
        };
        v.onerror = () => {
          cleanup();
          reject(new Error("Could not read video metadata. The file may be corrupt."));
        };
      });
    },
    []
  );

  const selectFile = useCallback(
    (file: File | null | undefined): string | null => {
      if (!file) {
        setError("No file selected.");
        return null;
      }

      const parsed = videoFileSchema.safeParse({
        name: file.name,
        size: file.size,
        type: file.type,
      });
      if (!parsed.success) {
        setError(parsed.error.issues[0]?.message ?? "Invalid file.");
        return null;
      }

      // Replace any previously selected file.
      releaseObjectUrl();
      const objectUrl = URL.createObjectURL(file);
      objectUrlRef.current = objectUrl;
      const id = makeId("vid");

      // Show the file immediately with basic metadata, then probe.
      setVideo({
        id,
        name: file.name,
        size: file.size,
        type: file.type,
        objectUrl,
      });
      setError(null);
      setIsProbing(true);

      probeVideo(objectUrl)
        .then((meta) => {
          setVideo((cur) =>
            cur && cur.id === id
              ? { ...cur, ...meta }
              : cur
          );
        })
        .catch((err: Error) => {
          setError(err.message);
        })
        .finally(() => setIsProbing(false));

      return id;
    },
    [probeVideo, releaseObjectUrl]
  );

  useEffect(() => {
    return () => {
      releaseObjectUrl();
    };
  }, [releaseObjectUrl]);

  return { video, error, isProbing, selectFile, clear };
}
