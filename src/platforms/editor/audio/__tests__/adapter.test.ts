import { describe, expect, test } from "bun:test";

import { audioEditorAdapter, parseLoudnessReportOutput, parseSilenceDetectOutput } from "../adapter.js";

describe("audio editor", () => {
  test("rejects invalid format names", () => {
    return expect(
      audioEditorAdapter.convert({
        inputPath: "/tmp/input.mp3",
        to: "not-a-format",
      }),
    ).rejects.toThrow();
  });

  test("parses silence detection output", () => {
    const parsed = parseSilenceDetectOutput(`
[silencedetect @ 0x123] silence_start: 1.25
[silencedetect @ 0x123] silence_end: 3.50 | silence_duration: 2.25
[silencedetect @ 0x123] silence_start: 6.0
[silencedetect @ 0x123] silence_end: 7.0 | silence_duration: 1.0
`);

    expect(parsed.segments).toHaveLength(2);
    expect(parsed.totalDurationSeconds).toBeCloseTo(3.25, 2);
    expect(parsed.segments[0]).toEqual({
      startSeconds: 1.25,
      endSeconds: 3.5,
      durationSeconds: 2.25,
    });
  });

  test("parses loudness report output", () => {
    const parsed = parseLoudnessReportOutput(`
{
  "input_i": "-15.5",
  "input_tp": "-1.2",
  "input_lra": "7.1",
  "input_thresh": "-25.0",
  "output_i": "-16.0",
  "output_tp": "-1.5",
  "output_lra": "7.1",
  "output_thresh": "-26.0",
  "normalization_type": "dynamic",
  "target_offset": "-0.5"
}
`);

    expect(parsed.inputIntegratedLufs).toBeCloseTo(-15.5, 2);
    expect(parsed.outputIntegratedLufs).toBeCloseTo(-16, 2);
    expect(parsed.normalizationType).toBe("dynamic");
    expect(parsed.targetOffsetDb).toBeCloseTo(-0.5, 2);
  });
});
