import { basename, extname } from "node:path";

import { MikaCliError } from "../../../errors.js";
import {
  clampNumber,
  parseRate,
  requirePositiveInteger,
  resolveEditorOutputPath,
  runFfmpegEdit,
  runFfprobe,
  toNumber,
} from "../shared/ffmpeg.js";

import type { AdapterActionResult, Platform } from "../../../types.js";

type GifInfoInput = {
  inputPath: string;
};

type GifCreateInput = {
  inputPath: string;
  start?: string;
  duration?: string;
  fps?: number | string;
  width?: number | string;
  output?: string;
};

type GifOptimizeInput = {
  inputPath: string;
  fps?: number | string;
  width?: number | string;
  output?: string;
};

type GifToVideoInput = {
  inputPath: string;
  to?: string;
  output?: string;
};

type GifVideoFormat = "mp4" | "mov" | "webm";

export class GifEditorAdapter {
  readonly platform: Platform = "gif" as unknown as Platform;
  readonly displayName = "GIF Editor";

  async info(input: GifInfoInput): Promise<AdapterActionResult> {
    const probe = await runFfprobe(input.inputPath);
    const stream = (probe.streams ?? []).find((entry) => entry.codec_type === "video");
    if (!stream) {
      throw new MikaCliError("GIF_INFO_UNAVAILABLE", "Could not read GIF/video stream information from the file.", {
        details: {
          inputPath: input.inputPath,
        },
      });
    }

    return this.buildResult({
      action: "info",
      message: `Loaded GIF info for ${basename(input.inputPath)}.`,
      data: {
        inputPath: input.inputPath,
        format: probe.format?.format_name ?? null,
        width: stream.width ?? null,
        height: stream.height ?? null,
        durationSeconds: toNumber(probe.format?.duration) ?? toNumber(stream.duration) ?? null,
        fps: parseRate(stream.r_frame_rate) ?? null,
        sizeBytes: toNumber(probe.format?.size) ?? null,
      },
    });
  }

  async create(input: GifCreateInput): Promise<AdapterActionResult> {
    const fps = clampNumber(Math.round(toNumber(input.fps) ?? 12), 1, 30);
    const width = input.width !== undefined ? requirePositiveInteger(input.width, "width") : 480;
    const outputPath = resolveEditorOutputPath({
      inputPath: input.inputPath,
      output: input.output,
      suffix: "gif",
      extension: "gif",
    });

    const resolvedOutput = await runFfmpegEdit({
      inputPath: input.inputPath,
      outputPath,
      args: [
        ...(input.start ? ["-ss", input.start] : []),
        "-i",
        "{input}",
        ...(input.duration ? ["-t", input.duration] : []),
        "-filter_complex",
        `fps=${fps},scale=${width}:-1:flags=lanczos,split[main][palettegen];[palettegen]palettegen=stats_mode=diff[palette];[main][palette]paletteuse=dither=bayer`,
        "{output}",
      ],
    });

    return this.buildResult({
      action: "create",
      message: `Created GIF at ${resolvedOutput}.`,
      data: {
        inputPath: input.inputPath,
        outputPath: resolvedOutput,
        fps,
        width,
        start: input.start ?? null,
        duration: input.duration ?? null,
      },
    });
  }

  async optimize(input: GifOptimizeInput): Promise<AdapterActionResult> {
    const fps = clampNumber(Math.round(toNumber(input.fps) ?? 12), 1, 30);
    const width = input.width !== undefined ? requirePositiveInteger(input.width, "width") : 480;
    const outputPath = resolveEditorOutputPath({
      inputPath: input.inputPath,
      output: input.output,
      suffix: "optimized",
      extension: "gif",
    });

    const resolvedOutput = await runFfmpegEdit({
      inputPath: input.inputPath,
      outputPath,
      args: [
        "-i",
        "{input}",
        "-filter_complex",
        `fps=${fps},scale=${width}:-1:flags=lanczos,split[main][palettegen];[palettegen]palettegen=stats_mode=diff[palette];[main][palette]paletteuse=dither=bayer`,
        "{output}",
      ],
    });

    return this.buildResult({
      action: "optimize",
      message: `Optimized GIF at ${resolvedOutput}.`,
      data: {
        inputPath: input.inputPath,
        outputPath: resolvedOutput,
        fps,
        width,
      },
    });
  }

  async toVideo(input: GifToVideoInput): Promise<AdapterActionResult> {
    const format = normalizeGifVideoFormat(input.to ?? "mp4");
    const outputPath = resolveEditorOutputPath({
      inputPath: input.inputPath,
      output: input.output,
      suffix: "video",
      extension: format,
    });

    const resolvedOutput = await runFfmpegEdit({
      inputPath: input.inputPath,
      outputPath,
      args: [
        "-stream_loop",
        "0",
        "-i",
        "{input}",
        ...(format === "webm"
          ? ["-c:v", "libvpx-vp9", "-crf", "30", "-b:v", "0", "{output}"]
          : ["-c:v", "libx264", "-pix_fmt", "yuv420p", ...(format === "mp4" ? ["-movflags", "+faststart"] : []), "{output}"]),
      ],
    });

    return this.buildResult({
      action: "to-video",
      message: `Converted GIF to ${format} at ${resolvedOutput}.`,
      data: {
        inputPath: input.inputPath,
        outputPath: resolvedOutput,
        format,
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

export const gifEditorAdapter = new GifEditorAdapter();

export function normalizeGifVideoFormat(value: string): GifVideoFormat {
  const normalized = value.trim().toLowerCase();
  if (normalized === "mp4" || normalized === "mov" || normalized === "webm") {
    return normalized;
  }

  throw new MikaCliError("EDITOR_INVALID_ARGUMENT", `Unsupported GIF video format "${value}".`, {
    details: {
      supportedFormats: ["mp4", "mov", "webm"],
    },
  });
}
