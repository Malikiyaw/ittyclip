import { describe, expect, it } from "vitest";
import { classifyLink, basenameFromUrl } from "@/lib/linkDetect";

describe("classifyLink", () => {
  it("classifies direct video links", () => {
    expect(classifyLink("https://cdn.example.com/videos/clip.mp4")).toBe("direct");
    expect(classifyLink("https://cdn.example.com/v/clip.webm?token=abc")).toBe("direct");
    expect(classifyLink("https://example.com/file.mov")).toBe("direct");
  });

  it("classifies platform pages", () => {
    expect(classifyLink("https://www.youtube.com/watch?v=abc123")).toBe("platform");
    expect(classifyLink("https://youtu.be/abc123")).toBe("platform");
    expect(classifyLink("https://www.youtube.com/shorts/abc123")).toBe("platform");
    expect(classifyLink("https://www.tiktok.com/@user/video/123456")).toBe("platform");
    expect(classifyLink("https://vm.tiktok.com/ZMabcdef/")).toBe("platform");
    expect(classifyLink("https://www.instagram.com/reel/xyz/")).toBe("platform");
    expect(classifyLink("https://vimeo.com/12345")).toBe("platform");
    expect(classifyLink("https://www.twitch.tv/videos/123456789")).toBe("platform");
    expect(classifyLink("https://x.com/user/status/123")).toBe("platform");
  });

  it("returns unknown for other urls", () => {
    expect(classifyLink("https://example.com/some-page")).toBe("unknown");
    expect(classifyLink("not a url")).toBe("unknown");
    expect(classifyLink("")).toBe("unknown");
  });
});

describe("basenameFromUrl", () => {
  it("extracts the file name", () => {
    expect(basenameFromUrl("https://cdn.example.com/videos/clip.mp4")).toBe("clip.mp4");
    expect(basenameFromUrl("https://cdn.example.com/videos/clip.mp4?token=a")).toBe("clip.mp4");
    expect(basenameFromUrl("https://cdn.example.com/v/clip%20final.webm")).toBe("clip_final.webm");
  });

  it("falls back when no file name is present", () => {
    expect(basenameFromUrl("https://cdn.example.com/videos/")).toBe("video-imported.mp4");
    expect(basenameFromUrl("garbage")).toBe("video-imported.mp4");
  });
});