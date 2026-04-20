import { describe, expect, test } from "bun:test";

import { buildDoctorFixPlan, buildDoctorRecommendations, summarizeDoctorChecks } from "../commands/doctor.js";

describe("doctor summary helpers", () => {
  test("summarizes pass warn fail counts and connection totals", () => {
    const summary = summarizeDoctorChecks([
      {
        id: "sessions-dir",
        category: "filesystem",
        status: "pass",
        message: "ok",
      },
      {
        id: "ffmpeg",
        category: "binary",
        status: "warn",
        message: "missing",
      },
      {
        id: "saved-records",
        category: "connections",
        status: "warn",
        message: "mixed",
        details: {
          records: 3,
          active: 1,
          expired: 1,
          unknown: 1,
        },
      },
      {
        id: "cache-dir",
        category: "filesystem",
        status: "fail",
        message: "not writable",
      },
    ]);

    expect(summary).toEqual({
      pass: 1,
      warn: 2,
      fail: 1,
      total: 4,
      records: 3,
      active: 1,
      expired: 1,
      unknown: 1,
    });
  });

  test("builds useful follow-up recommendations", () => {
    const checks = [
      {
        id: "sessions-dir",
        category: "filesystem" as const,
        status: "fail" as const,
        message: "not writable",
      },
      {
        id: "ffmpeg",
        category: "binary" as const,
        status: "warn" as const,
        message: "missing",
        details: {
          installHint: "Install FFmpeg with `brew install ffmpeg`.",
        },
      },
    ];

    const recommendations = buildDoctorRecommendations(checks, {
      pass: 0,
      warn: 1,
      fail: 1,
      total: 2,
      records: 0,
      active: 0,
      expired: 0,
      unknown: 0,
    });

    expect(recommendations).toEqual([
      "Fix the failing MikaCLI directories first so sessions, browser state, and jobs can be saved correctly.",
      "Run `mikacli doctor --fix` to install all supported missing browser and local-tool dependencies automatically.",
      "Run `mikacli login --browser` or a provider-specific `login` command to save your first reusable account.",
      "Install FFmpeg with `brew install ffmpeg`.",
    ]);
  });

  test("adds browser-specific recommendations when the shared browser is missing", () => {
    const recommendations = buildDoctorRecommendations(
      [
        {
          id: "browser-executable",
          category: "browser",
          status: "warn",
          message: "missing",
          details: {
            installHint: "Install Google Chrome or Chromium, then re-run `mikacli doctor`.",
          },
        },
        {
          id: "shared-browser-profile",
          category: "browser",
          status: "warn",
          message: "not created",
        },
      ],
      {
        pass: 0,
        warn: 2,
        fail: 0,
        total: 2,
        records: 1,
        active: 1,
        expired: 0,
        unknown: 0,
      },
    );

    expect(recommendations).toEqual([
      "Run `mikacli doctor --fix` to install all supported missing browser and local-tool dependencies automatically.",
      "Install a Chrome/Chromium browser for browser-backed actions. Install Google Chrome or Chromium, then re-run `mikacli doctor`.",
      "Run `mikacli login --browser` once to create the shared MikaCLI browser profile before using browser-backed actions.",
    ]);
  });

  test("builds a macOS auto-fix plan with deduped brew targets", () => {
    const plan = buildDoctorFixPlan(
      [
        {
          id: "browser-executable",
          category: "browser",
          status: "warn",
          message: "missing",
        },
        {
          id: "ffmpeg",
          category: "binary",
          status: "warn",
          message: "missing",
        },
        {
          id: "ffprobe",
          category: "binary",
          status: "warn",
          message: "missing",
        },
        {
          id: "pdftotext",
          category: "binary",
          status: "warn",
          message: "missing",
        },
        {
          id: "pdftoppm",
          category: "binary",
          status: "warn",
          message: "missing",
        },
        {
          id: "7z",
          category: "binary",
          status: "warn",
          message: "missing",
        },
      ],
      "darwin",
    );

    expect(plan).toEqual({
      supported: true,
      manager: "brew",
      targets: [
        {
          id: "browser-executable",
          kind: "brew-cask",
          packageName: "google-chrome",
          reason: "Chrome/Chromium is needed for shared-browser login and browser-backed actions.",
          checkIds: ["browser-executable"],
        },
        {
          id: "ffmpeg",
          kind: "brew",
          packageName: "ffmpeg",
          reason: "Installs FFmpeg, ffprobe, and ffplay for media workflows.",
          checkIds: ["ffmpeg", "ffprobe"],
        },
        {
          id: "poppler",
          kind: "brew",
          packageName: "poppler",
          reason: "Installs Poppler tools for PDF text extraction and rendering.",
          checkIds: ["pdftotext", "pdftoppm"],
        },
        {
          id: "7z",
          kind: "brew",
          packageName: "p7zip",
          reason: "Installs 7-Zip support for archive workflows.",
          checkIds: ["7z"],
        },
      ],
      skipped: [],
    });
  });

  test("skips unsupported auto-install targets", () => {
    const plan = buildDoctorFixPlan(
      [
        {
          id: "zip",
          category: "binary",
          status: "warn",
          message: "missing",
        },
      ],
      "darwin",
    );

    expect(plan).toEqual({
      supported: true,
      manager: "brew",
      targets: [],
      skipped: [
        {
          id: "zip",
          reason:
            "This archive utility is not auto-installed by `doctor --fix`. Install Xcode Command Line Tools or your preferred package manager if needed.",
        },
      ],
    });
  });
});
