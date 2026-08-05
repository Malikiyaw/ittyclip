"use client";

import type { AspectKey } from "@/lib/types";
import { ASPECTS } from "@/lib/types";

export interface ThumbRequest {
  url: string;
  time: number;
  aspect: AspectKey;
}

export function extractThumb(req: ThumbRequest, maxW = 480): Promise<string> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.src = req.url;
    const ratio = ASPECTS[req.aspect].ratio;
    const cleanup = () => {
      video.removeAttribute("src");
      video.load();
    };
    video.onloadedmetadata = () => {
      try {
        video.currentTime = Math.min(Math.max(req.time, 0), Math.max(0, (video.duration || 0) - 0.1));
      } catch {
        cleanup();
        reject(new Error("seek failed"));
        return;
      }
    };
    video.onseeked = () => {
      try {
        const vw = video.videoWidth || 1280;
        const vh = video.videoHeight || 720;
        const scale = Math.max(vw / (ratio * vh), vh / vw);
        const dw = Math.min(maxW, Math.round((ratio * vh * scale) / 2) * 2);
        const dh = Math.round((dw / ratio) / 2) * 2;
        const sw = Math.min(vw, Math.round(dw * scale));
        const sh = Math.min(vh, Math.round(dh * scale));
        const sx = Math.round((vw - sw) / 2);
        const sy = Math.round((vh - sh) / 2);
        const canvas = document.createElement("canvas");
        canvas.width = dw;
        canvas.height = dh;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          cleanup();
          reject(new Error("canvas unavailable"));
          return;
        }
        ctx.drawImage(video, sx, sy, sw, sh, 0, 0, dw, dh);
        cleanup();
        resolve(canvas.toDataURL("image/jpeg", 0.72));
      } catch (err) {
        cleanup();
        reject(err instanceof Error ? err : new Error("thumb failed"));
      }
    };
    video.onerror = () => {
      cleanup();
      reject(new Error("video load failed"));
    };
  });
}
