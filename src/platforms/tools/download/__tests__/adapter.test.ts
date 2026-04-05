import { describe, expect, test } from "bun:test";
import { join, resolve } from "node:path";

import { buildVideoFormatSelector, normalizeDownloadUrl, resolveDownloadOutputDir, summarizeDownloadFormats, summarizePlaylistEntries } from "../adapter.js";

describe("download tools adapter helpers", () => {
  test("normalizes valid media URLs", () => {
    expect(normalizeDownloadUrl("https://example.com/watch?v=123")).toBe("https://example.com/watch?v=123");
  });

  test("builds a bounded quality selector when quality is provided", () => {
    expect(buildVideoFormatSelector({ quality: "720p" })).toBe("bestvideo*[height<=720]+bestaudio/best");
    expect(buildVideoFormatSelector({ quality: "1080" })).toBe("bestvideo*[height<=1080]+bestaudio/best");
  });

  test("prefers an explicit custom format selector", () => {
    expect(buildVideoFormatSelector({ format: "bv*[ext=mp4]+ba[ext=m4a]/b[ext=mp4]" })).toBe("bv*[ext=mp4]+ba[ext=m4a]/b[ext=mp4]");
  });

  test("summarizes the best visible format per resolution", () => {
    expect(summarizeDownloadFormats([
      { format_id: "137", height: 1080, ext: "mp4", tbr: 2500, vcodec: "avc1", acodec: "none" },
      { format_id: "248", height: 1080, ext: "webm", tbr: 1800, vcodec: "vp9", acodec: "none" },
      { format_id: "22", height: 720, ext: "mp4", tbr: 1200, vcodec: "avc1", acodec: "mp4a.40.2" },
      { format_id: "18", height: 360, ext: "mp4", tbr: 500, vcodec: "avc1", acodec: "mp4a.40.2" },
    ])).toEqual([
      { id: "137", label: "1080p mp4 video-only", ext: "mp4", height: 1080, fps: undefined, hasAudio: false },
      { id: "22", label: "720p mp4", ext: "mp4", height: 720, fps: undefined, hasAudio: true },
      { id: "18", label: "360p mp4", ext: "mp4", height: 360, fps: undefined, hasAudio: true },
    ]);
  });

  test("summarizes playlist entries with a limit", () => {
    expect(summarizePlaylistEntries([
      { id: "a1", url: "https://example.com/watch?v=a1", title: "First", duration: 61, uploader: "Uploader A" },
      { id: "a2", url: "https://example.com/watch?v=a2", title: "Second", duration: 125, channel: "Channel B" },
    ], 1)).toEqual([
      { id: "a1", url: "https://example.com/watch?v=a1", title: "First", durationLabel: "1:01", uploader: "Uploader A" },
    ]);
  });

  test("uses a single downloads folder by default", () => {
    expect(resolveDownloadOutputDir()).toBe(resolve(join(process.cwd(), "downloads")));
  });
});
