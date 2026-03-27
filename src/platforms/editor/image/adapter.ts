import { basename } from "node:path";

import {
  requireNonNegativeInteger,
  requirePositiveInteger,
  resolveEditorOutputPath,
  runFfmpegEdit,
  runFfprobe,
  toNumber,
} from "../shared/ffmpeg.js";
import { AutoCliError } from "../../../errors.js";

import type { AdapterActionResult, Platform } from "../../../types.js";

type ImageInfoInput = {
  inputPath: string;
};

type ImageResizeInput = {
  inputPath: string;
  width?: number | string;
  height?: number | string;
  output?: string;
};

type ImageCropInput = {
  inputPath: string;
  width: number | string;
  height: number | string;
  x?: number | string;
  y?: number | string;
  output?: string;
};

type ImageConvertInput = {
  inputPath: string;
  to: string;
  output?: string;
};

type ImageRotateInput = {
  inputPath: string;
  degrees: number | string;
  output?: string;
};

export class ImageEditorAdapter {
  readonly platform: Platform = "image" as Platform;
  readonly displayName = "Image Editor";

  async info(input: ImageInfoInput): Promise<AdapterActionResult> {
    const probe = await runFfprobe(input.inputPath);
    const stream = (probe.streams ?? []).find((entry) => entry.codec_type === "video");
    if (!stream) {
      throw new AutoCliError("IMAGE_INFO_UNAVAILABLE", "Could not read image dimensions from the file.", {
        details: {
          inputPath: input.inputPath,
        },
      });
    }

    const width = typeof stream.width === "number" ? stream.width : null;
    const height = typeof stream.height === "number" ? stream.height : null;
    const sizeBytes = toNumber(probe.format?.size) ?? null;
    const formatName = probe.format?.format_name ?? stream.codec_name ?? null;

    return this.buildResult({
      action: "info",
      message: `Loaded image info for ${basename(input.inputPath)}.`,
      data: {
        inputPath: input.inputPath,
        format: formatName,
        width,
        height,
        pixelFormat: stream.pix_fmt ?? null,
        sizeBytes,
      },
    });
  }

  async resize(input: ImageResizeInput): Promise<AdapterActionResult> {
    const width = input.width !== undefined ? requirePositiveInteger(input.width, "width") : undefined;
    const height = input.height !== undefined ? requirePositiveInteger(input.height, "height") : undefined;
    if (!width && !height) {
      throw new AutoCliError("EDITOR_INVALID_ARGUMENT", "Resize needs at least one of --width or --height.");
    }

    const outputPath = resolveEditorOutputPath({
      inputPath: input.inputPath,
      output: input.output,
      suffix: "resized",
    });

    const scaleFilter = buildScaleFilter(width, height);
    const resolvedOutput = await runFfmpegEdit({
      inputPath: input.inputPath,
      outputPath,
      args: ["-i", "{input}", "-vf", scaleFilter, "{output}"],
    });

    return this.buildResult({
      action: "resize",
      message: `Saved resized image to ${resolvedOutput}.`,
      data: {
        inputPath: input.inputPath,
        outputPath: resolvedOutput,
        width: width ?? null,
        height: height ?? null,
      },
    });
  }

  async crop(input: ImageCropInput): Promise<AdapterActionResult> {
    const width = requirePositiveInteger(input.width, "width");
    const height = requirePositiveInteger(input.height, "height");
    const x = input.x !== undefined ? requireNonNegativeInteger(input.x, "x") : 0;
    const y = input.y !== undefined ? requireNonNegativeInteger(input.y, "y") : 0;

    const outputPath = resolveEditorOutputPath({
      inputPath: input.inputPath,
      output: input.output,
      suffix: "cropped",
    });

    const resolvedOutput = await runFfmpegEdit({
      inputPath: input.inputPath,
      outputPath,
      args: ["-i", "{input}", "-vf", `crop=${width}:${height}:${x}:${y}`, "{output}"],
    });

    return this.buildResult({
      action: "crop",
      message: `Saved cropped image to ${resolvedOutput}.`,
      data: {
        inputPath: input.inputPath,
        outputPath: resolvedOutput,
        width,
        height,
        x,
        y,
      },
    });
  }

  async convert(input: ImageConvertInput): Promise<AdapterActionResult> {
    const format = normalizeImageFormat(input.to);
    const outputPath = resolveEditorOutputPath({
      inputPath: input.inputPath,
      output: input.output,
      suffix: "converted",
      extension: format === "jpeg" ? "jpg" : format,
    });

    const resolvedOutput = await runFfmpegEdit({
      inputPath: input.inputPath,
      outputPath,
      args: ["-i", "{input}", "{output}"],
    });

    return this.buildResult({
      action: "convert",
      message: `Converted image to ${format} at ${resolvedOutput}.`,
      data: {
        inputPath: input.inputPath,
        outputPath: resolvedOutput,
        format,
      },
    });
  }

  async rotate(input: ImageRotateInput): Promise<AdapterActionResult> {
    const degrees = toNumber(input.degrees);
    if (degrees === undefined) {
      throw new AutoCliError("EDITOR_INVALID_ARGUMENT", "degrees must be a valid number.");
    }

    const outputPath = resolveEditorOutputPath({
      inputPath: input.inputPath,
      output: input.output,
      suffix: "rotated",
    });

    const radians = degrees * (Math.PI / 180);
    const resolvedOutput = await runFfmpegEdit({
      inputPath: input.inputPath,
      outputPath,
      args: [
        "-i",
        "{input}",
        "-vf",
        `rotate=${radians}:ow=rotw(iw):oh=roth(ih):c=none`,
        "{output}",
      ],
    });

    return this.buildResult({
      action: "rotate",
      message: `Saved rotated image to ${resolvedOutput}.`,
      data: {
        inputPath: input.inputPath,
        outputPath: resolvedOutput,
        degrees,
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

export const imageEditorAdapter = new ImageEditorAdapter();

export function buildScaleFilter(width?: number, height?: number): string {
  if (width && height) {
    return `scale=${width}:${height}`;
  }

  if (width) {
    return `scale=${width}:-1`;
  }

  if (height) {
    return `scale=-1:${height}`;
  }

  return "scale=iw:ih";
}

function normalizeImageFormat(value: string): "png" | "jpeg" | "webp" | "bmp" {
  const normalized = value.trim().toLowerCase();
  if (normalized === "jpg" || normalized === "jpeg") {
    return "jpeg";
  }
  if (normalized === "png" || normalized === "webp" || normalized === "bmp") {
    return normalized;
  }

  throw new AutoCliError("EDITOR_INVALID_ARGUMENT", `Unsupported image format "${value}".`, {
    details: {
      supportedFormats: ["png", "jpg", "jpeg", "webp", "bmp"],
    },
  });
}
