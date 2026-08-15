import { describe, expect, it } from "vitest";
import { classifyLink, basenameFromUrl } from "@/lib/linkDetect";
import { friendlyResolutionError } from "@/lib/server/ytdlp";

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

describe("friendlyResolutionError", () => {
  it("classifies the YouTube bot-check instead of generic login", () => {
    const msg = friendlyResolutionError(
      "ERROR: [youtube] AbCdEf: Sign in to confirm you're not a bot."
    );
    expect(msg).toContain("not a bot");
    expect(msg).not.toContain("requires a login to download");
  });

  it("classifies the TikTok unexpected-response block", () => {
    const msg = friendlyResolutionError(
      "ERROR: [TikTok] 123456: Unexpected response from webpage request"
    );
    expect(msg).toContain("TikTok");
  });

  it("classifies specific failure causes before generic login", () => {
    expect(friendlyResolutionError("This video is private")).toContain("private");
    expect(friendlyResolutionError("ERROR: Sign in to view this video")).toContain(
      "age-restricted or members-only"
    );
    expect(friendlyResolutionError("Video unavailable")).toContain("unavailable");
    expect(friendlyResolutionError("ERROR: [youtube] abc: This video is a live stream")).toContain(
      "Live streams"
    );
  });

  it("falls through to the login hint only for genuine login errors", () => {
    expect(friendlyResolutionError("ERROR: You must log in to access this content")).toContain(
      "YTDLP_COOKIES"
    );
    expect(friendlyResolutionError("ERROR: Please log in and try again")).toContain("YTDLP_COOKIES");
  });
});