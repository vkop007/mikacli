import { describe, expect, test } from "bun:test";

import { summarizeDoctorChecks } from "../commands/doctor.js";

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
});
