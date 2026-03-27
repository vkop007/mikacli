import { basename, extname } from "node:path";

import {
  parseRate,
  resolveEditorOutputPath,
  runFfmpegEdit,
  runFfprobe,
  toNumber,
} from "../shared/ffmpeg.js";
import { AutoCliError } from "../../../errors.js";

import type { AdapterActionResult, Platform } from "../../../types.js";

type VideoInfoInput = {
  inputPath: string;
};

type VideoTrimInput = {
  inputPath: string;
  start?: string;
  end?: string;
  duration?: string;
  output?: string;
};

type VideoConvertInput = {
  inputPath: string;
  to: string;
  output?: string;
};

type VideoCompressInput = {
  inputPath: string;
  crf?: number | string;
  preset?: string;
  to?: string;
  output?: string;
};

type VideoThumbnailInput = {
  inputPath: string;
  at?: string;
  output?: string;
};

export class VideoEditorAdapter {
  readonly platform: Platform = "video" as Platform;
  readonly displayName = "Video Editor";

  async info(input: VideoInfoInput): Promise<AdapterActionResult> {
    const probe = await runFfprobe(input.inputPath);
    const videoStream = (probe.streams ?? []).find((entry) => entry.codec_type === "video");
    const audioStream = (probe.streams ?? []).find((entry) => entry.codec_type === "audio");

    if (!videoStream) {
      throw new AutoCliError("VIDEO_INFO_UNAVAILABLE", "Could not read video stream information from the file.", {
        details: {
          inputPath: input.inputPath,
        },
      });
    }

    return this.buildResult({
      action: "info",
      message: `Loaded video info for ${basename(input.inputPath)}.`,
      data: {
        inputPath: input.inputPath,
        format: probe.format?.format_name ?? null,
        width: videoStream.width ?? null,
        height: videoStream.height ?? null,
        videoCodec: videoStream.codec_name ?? null,
        audioCodec: audioStream?.codec_name ?? null,
        durationSeconds: toNumber(probe.format?.duration) ?? toNumber(videoStream.duration) ?? null,
        bitRate: toNumber(probe.format?.bit_rate) ?? null,
        fps: parseRate(videoStream.r_frame_rate) ?? null,
      },
    });
  }

  async trim(input: VideoTrimInput): Promise<AdapterActionResult> {
    if (!input.start && !input.end && !input.duration) {
      throw new AutoCliError("EDITOR_INVALID_ARGUMENT", "Trim needs at least one of --start, --end, or --duration.");
    }
    if (input.end && input.duration) {
      throw new AutoCliError("EDITOR_INVALID_ARGUMENT", "Use either --end or --duration, not both.");
    }

    const extension = normalizeVideoExtension(extname(input.inputPath).replace(/^\./, "") || "mp4");
    const outputPath = resolveEditorOutputPath({
      inputPath: input.inputPath,
      output: input.output,
      suffix: "trimmed",
      extension,
    });

    const args = [
      ...(input.start ? ["-ss", input.start] : []),
      ...(input.end ? ["-to", input.end] : []),
      "-i",
      "{input}",
      ...(input.duration ? ["-t", input.duration] : []),
      ...buildVideoCodecArgs(extension, 21, "medium"),
      "{output}",
    ];

    const resolvedOutput = await runFfmpegEdit({
      inputPath: input.inputPath,
      outputPath,
      args,
    });

    return this.buildResult({
      action: "trim",
      message: `Saved trimmed video to ${resolvedOutput}.`,
      data: {
        inputPath: input.inputPath,
        outputPath: resolvedOutput,
        start: input.start ?? null,
        end: input.end ?? null,
        duration: input.duration ?? null,
      },
    });
  }

  async convert(input: VideoConvertInput): Promise<AdapterActionResult> {
    const format = normalizeVideoExtension(input.to);
    const outputPath = resolveEditorOutputPath({
      inputPath: input.inputPath,
      output: input.output,
      suffix: "converted",
      extension: format,
    });

    const resolvedOutput = await runFfmpegEdit({
      inputPath: input.inputPath,
      outputPath,
      args: ["-i", "{input}", ...buildVideoCodecArgs(format, 21, "medium"), "{output}"],
    });

    return this.buildResult({
      action: "convert",
      message: `Converted video to ${format} at ${resolvedOutput}.`,
      data: {
        inputPath: input.inputPath,
        outputPath: resolvedOutput,
        format,
      },
    });
  }

  async compress(input: VideoCompressInput): Promise<AdapterActionResult> {
    const format = normalizeVideoExtension(input.to || extname(input.inputPath).replace(/^\./, "") || "mp4");
    const crf = clampCrf(toNumber(input.crf) ?? 28);
    const preset = normalizePreset(input.preset);
    const outputPath = resolveEditorOutputPath({
      inputPath: input.inputPath,
      output: input.output,
      suffix: "compressed",
      extension: format,
    });

    const resolvedOutput = await runFfmpegEdit({
      inputPath: input.inputPath,
      outputPath,
      args: ["-i", "{input}", ...buildVideoCodecArgs(format, crf, preset), "{output}"],
    });

    return this.buildResult({
      action: "compress",
      message: `Saved compressed video to ${resolvedOutput}.`,
      data: {
        inputPath: input.inputPath,
        outputPath: resolvedOutput,
        format,
        crf,
        preset,
      },
    });
  }

  async thumbnail(input: VideoThumbnailInput): Promise<AdapterActionResult> {
    const outputPath = resolveEditorOutputPath({
      inputPath: input.inputPath,
      output: input.output,
      suffix: "thumbnail",
      extension: "png",
    });

    const resolvedOutput = await runFfmpegEdit({
      inputPath: input.inputPath,
      outputPath,
      args: [
        "-ss",
        input.at ?? "00:00:01",
        "-i",
        "{input}",
        "-frames:v",
        "1",
        "-q:v",
        "2",
        "{output}",
      ],
    });

    return this.buildResult({
      action: "thumbnail",
      message: `Saved video thumbnail to ${resolvedOutput}.`,
      data: {
        inputPath: input.inputPath,
        outputPath: resolvedOutput,
        at: input.at ?? "00:00:01",
      },
    });
  }

  private buildResult(input: {
    action: string;
    message: string;
    data: Record<string, unknown>;
  }): AdapterActionResult {
    return {
      ok: true,
      platform: this.platform,
      account: "local",
      action: input.action,
      message: input.message,
      data: input.data,
    };
  }
}

export const videoEditorAdapter = new VideoEditorAdapter();

function normalizeVideoExtension(value: string): "mp4" | "mov" | "webm" {
  const normalized = value.trim().toLowerCase();
  if (normalized === "mp4" || normalized === "mov" || normalized === "webm") {
    return normalized;
  }

  throw new AutoCliError("EDITOR_INVALID_ARGUMENT", `Unsupported video format "${value}".`, {
    details: {
      supportedFormats: ["mp4", "mov", "webm"],
    },
  });
}

function normalizePreset(value: string | undefined): string {
  const normalized = value?.trim().toLowerCase() ?? "medium";
  const supported = new Set(["ultrafast", "superfast", "veryfast", "faster", "fast", "medium", "slow", "slower"]);
  if (!supported.has(normalized)) {
    throw new AutoCliError("EDITOR_INVALID_ARGUMENT", `Unsupported preset "${value}".`, {
      details: {
        supportedPresets: [...supported],
      },
    });
  }

  return normalized;
}

function clampCrf(value: number): number {
  return Math.max(0, Math.min(51, Math.round(value)));
}

function buildVideoCodecArgs(format: "mp4" | "mov" | "webm", crf: number, preset: string): string[] {
  if (format === "webm") {
    return [
      "-c:v",
      "libvpx-vp9",
      "-crf",
      String(Math.max(4, Math.min(63, crf + 4))),
      "-b:v",
      "0",
      "-row-mt",
      "1",
      "-c:a",
      "libopus",
      "-b:a",
      "128k",
    ];
  }

  return [
    "-c:v",
    "libx264",
    "-preset",
    preset,
    "-crf",
    String(crf),
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-b:a",
    "192k",
    ...(format === "mp4" ? ["-movflags", "+faststart"] : []),
  ];
}
