import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { basename, extname, join, parse, resolve } from "node:path";

import {
  assertLocalInputFile,
  clampNumber,
  parseRate,
  requireNonNegativeInteger,
  requirePositiveInteger,
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

type VideoSceneDetectInput = {
  inputPath: string;
  threshold?: number | string;
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

type VideoSpeedInput = {
  inputPath: string;
  factor?: number | string;
  output?: string;
};

type VideoReverseInput = {
  inputPath: string;
  output?: string;
};

type VideoBoomerangInput = {
  inputPath: string;
  output?: string;
};

type VideoThumbnailInput = {
  inputPath: string;
  at?: string;
  output?: string;
};

type VideoResizeInput = {
  inputPath: string;
  width?: number | string;
  height?: number | string;
  output?: string;
};

type VideoCropInput = {
  inputPath: string;
  width: number | string;
  height: number | string;
  x?: number | string;
  y?: number | string;
  output?: string;
};

type VideoExtractAudioInput = {
  inputPath: string;
  to?: string;
  output?: string;
};

type VideoMuteInput = {
  inputPath: string;
  output?: string;
};

type VideoGifInput = {
  inputPath: string;
  start?: string;
  duration?: string;
  fps?: number | string;
  width?: number | string;
  output?: string;
};

type VideoConcatInput = {
  inputPaths: string[];
  output?: string;
};

type VideoSubtitleBurnInput = {
  inputPath: string;
  subtitlePath: string;
  output?: string;
};

type VideoOverlayImageInput = {
  inputPath: string;
  overlayPath: string;
  position?: string;
  margin?: number | string;
  width?: number | string;
  output?: string;
};

type VideoOverlayTextInput = {
  inputPath: string;
  text: string;
  position?: string;
  margin?: number | string;
  fontSize?: number | string;
  color?: string;
  box?: boolean;
  boxColor?: string;
  boxOpacity?: number | string;
  output?: string;
};

type VideoAudioReplaceInput = {
  inputPath: string;
  audioPath: string;
  output?: string;
};

type VideoFrameExtractInput = {
  inputPath: string;
  start?: string;
  duration?: string;
  fps?: number | string;
  outputDir?: string;
  prefix?: string;
  format?: string;
};

type VideoSplitInput = {
  inputPath: string;
  duration: string;
  outputDir?: string;
  prefix?: string;
  to?: string;
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

  async sceneDetect(input: VideoSceneDetectInput): Promise<AdapterActionResult> {
    const resolvedInput = await assertLocalInputFile(input.inputPath);
    const probe = await runFfprobe(resolvedInput);
    const videoStream = (probe.streams ?? []).find((entry) => entry.codec_type === "video");

    if (!videoStream) {
      throw new AutoCliError("VIDEO_INFO_UNAVAILABLE", "Could not read video stream information from the file.", {
        details: {
          inputPath: resolvedInput,
        },
      });
    }

    const rawThreshold = clampNumber(toNumber(input.threshold) ?? 10, 0, 100);
    const threshold = rawThreshold > 1 ? rawThreshold / 100 : rawThreshold;
    const log = await runVideoAnalysis({
      inputPath: resolvedInput,
      args: [
        "-vf",
        `scdet=threshold=${formatFilterNumber(threshold)},metadata=print`,
        "-an",
        "-f",
        "null",
        "-",
      ],
    });

    const sceneChanges = parseSceneDetectLog(log);
    const sceneSegments = buildSceneSegments(sceneChanges, toNumber(probe.format?.duration) ?? toNumber(videoStream.duration));

    return this.buildResult({
      action: "scene-detect",
      message:
        sceneChanges.length > 0
          ? `Detected ${sceneChanges.length} scene change${sceneChanges.length === 1 ? "" : "s"} in ${basename(resolvedInput)}.`
          : `No scene changes detected in ${basename(resolvedInput)} at threshold ${rawThreshold}.`,
      data: {
        inputPath: resolvedInput,
        format: probe.format?.format_name ?? null,
        width: videoStream.width ?? null,
        height: videoStream.height ?? null,
        videoCodec: videoStream.codec_name ?? null,
        audioCodec: (probe.streams ?? []).find((entry) => entry.codec_type === "audio")?.codec_name ?? null,
        durationSeconds: toNumber(probe.format?.duration) ?? toNumber(videoStream.duration) ?? null,
        fps: parseRate(videoStream.r_frame_rate) ?? null,
        threshold: rawThreshold,
        internalThreshold: threshold,
        sceneCount: sceneChanges.length,
        sceneChanges,
        sceneSegments,
      },
    });
  }

  async split(input: VideoSplitInput): Promise<AdapterActionResult> {
    const resolvedInput = await assertLocalInputFile(input.inputPath);
    const segmentDurationSeconds = parseFlexibleDuration(input.duration, "duration");
    const probe = await runFfprobe(resolvedInput);
    const totalDuration = toNumber(probe.format?.duration)
      ?? toNumber((probe.streams ?? []).find((entry) => entry.codec_type === "video")?.duration);

    if (totalDuration === undefined || !Number.isFinite(totalDuration) || totalDuration <= 0) {
      throw new AutoCliError("VIDEO_INFO_UNAVAILABLE", "Could not determine the total video duration for splitting.", {
        details: {
          inputPath: resolvedInput,
        },
      });
    }

    const format = normalizeVideoExtension(input.to || extname(resolvedInput).replace(/^\./, "") || "mp4");
    const outputDir = resolve(input.outputDir ?? parse(resolvedInput).dir);
    const prefix = normalizePrefix(input.prefix ?? parse(resolvedInput).name);
    const outputPaths: string[] = [];

    for (let index = 0, start = 0; start < totalDuration - 0.001; index += 1, start += segmentDurationSeconds) {
      const outputPath = join(outputDir, `${prefix}.part-${String(index + 1).padStart(3, "0")}.${format}`);
      const remaining = Math.max(0.05, Math.min(segmentDurationSeconds, totalDuration - start));
      const resolvedOutput = await runFfmpegEdit({
        inputPath: resolvedInput,
        outputPath,
        args: [
          "-ss",
          formatSecondsForFfmpeg(start),
          "-i",
          "{input}",
          "-t",
          formatSecondsForFfmpeg(remaining),
          ...buildVideoCodecArgs(format, 21, "medium"),
          "{output}",
        ],
      });
      outputPaths.push(resolvedOutput);
    }

    return this.buildResult({
      action: "split",
      message: `Split ${basename(resolvedInput)} into ${outputPaths.length} video parts.`,
      data: {
        inputPath: resolvedInput,
        outputDir,
        prefix,
        format,
        segmentDurationSeconds,
        totalDurationSeconds: totalDuration,
        outputPaths,
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

  async speed(input: VideoSpeedInput): Promise<AdapterActionResult> {
    const factor = requirePositiveNumber(input.factor ?? 1, "factor");
    const format = normalizeVideoExtension(extname(input.inputPath).replace(/^\./, "") || "mp4");
    const outputPath = resolveEditorOutputPath({
      inputPath: input.inputPath,
      output: input.output,
      suffix: "sped",
      extension: format,
    });
    const probe = await runFfprobe(input.inputPath);
    const hasAudio = (probe.streams ?? []).some((entry) => entry.codec_type === "audio");

    const args = hasAudio
      ? [
          "-i",
          "{input}",
          "-filter_complex",
          `[0:v]${buildSpeedVideoFilter(factor)}[v];[0:a]${buildAtempoChain(factor)}[a]`,
          "-map",
          "[v]",
          "-map",
          "[a]",
          ...buildVideoCodecArgs(format, 21, "medium"),
          "{output}",
        ]
      : [
          "-i",
          "{input}",
          "-vf",
          buildSpeedVideoFilter(factor),
          "-map",
          "0:v:0",
          "-map",
          "0:a?",
          ...buildVideoCodecArgs(format, 21, "medium"),
          "{output}",
        ];

    const resolvedOutput = await runFfmpegEdit({
      inputPath: input.inputPath,
      outputPath,
      args,
    });

    return this.buildResult({
      action: "speed",
      message: `Saved speed-adjusted video to ${resolvedOutput}.`,
      data: {
        inputPath: input.inputPath,
        outputPath: resolvedOutput,
        factor,
        hasAudio,
      },
    });
  }

  async reverse(input: VideoReverseInput): Promise<AdapterActionResult> {
    const format = normalizeVideoExtension(extname(input.inputPath).replace(/^\./, "") || "mp4");
    const outputPath = resolveEditorOutputPath({
      inputPath: input.inputPath,
      output: input.output,
      suffix: "reversed",
      extension: format,
    });
    const probe = await runFfprobe(input.inputPath);
    const hasAudio = (probe.streams ?? []).some((entry) => entry.codec_type === "audio");

    const args = hasAudio
      ? [
          "-i",
          "{input}",
          "-filter_complex",
          "[0:v]reverse[v];[0:a]areverse[a]",
          "-map",
          "[v]",
          "-map",
          "[a]",
          ...buildVideoCodecArgs(format, 21, "medium"),
          "{output}",
        ]
      : [
          "-i",
          "{input}",
          "-vf",
          "reverse",
          "-map",
          "0:v:0",
          "-map",
          "0:a?",
          ...buildVideoCodecArgs(format, 21, "medium"),
          "{output}",
        ];

    const resolvedOutput = await runFfmpegEdit({
      inputPath: input.inputPath,
      outputPath,
      args,
    });

    return this.buildResult({
      action: "reverse",
      message: `Saved reversed video to ${resolvedOutput}.`,
      data: {
        inputPath: input.inputPath,
        outputPath: resolvedOutput,
        hasAudio,
      },
    });
  }

  async boomerang(input: VideoBoomerangInput): Promise<AdapterActionResult> {
    const resolvedInput = await assertLocalInputFile(input.inputPath);
    const probe = await runFfprobe(resolvedInput);
    const hasAudio = (probe.streams ?? []).some((entry) => entry.codec_type === "audio");
    const format = normalizeVideoExtension(extname(resolvedInput).replace(/^\./, "") || "mp4");
    const outputPath = resolveEditorOutputPath({
      inputPath: resolvedInput,
      output: input.output,
      suffix: "boomerang",
      extension: format,
    });

    const args = hasAudio
      ? [
          "-i",
          "{input}",
          "-filter_complex",
          "[0:v]split[v1][v2];[v2]reverse[vrev];[0:a]asplit[a1][a2];[a2]areverse[arev];[v1][a1][vrev][arev]concat=n=2:v=1:a=1[v][a]",
          "-map",
          "[v]",
          "-map",
          "[a]",
          ...buildVideoCodecArgs(format, 21, "medium"),
          "{output}",
        ]
      : [
          "-i",
          "{input}",
          "-filter_complex",
          "[0:v]split[v1][v2];[v2]reverse[vrev];[v1][vrev]concat=n=2:v=1:a=0[v]",
          "-map",
          "[v]",
          ...buildVideoCodecArgs(format, 21, "medium"),
          "{output}",
        ];

    const resolvedOutput = await runFfmpegEdit({
      inputPath: resolvedInput,
      outputPath,
      args,
    });

    return this.buildResult({
      action: "boomerang",
      message: `Saved boomerang video to ${resolvedOutput}.`,
      data: {
        inputPath: resolvedInput,
        outputPath: resolvedOutput,
        format,
        hasAudio,
      },
    });
  }

  async overlayImage(input: VideoOverlayImageInput): Promise<AdapterActionResult> {
    const overlayPath = await assertLocalInputFile(input.overlayPath);
    const margin = input.margin !== undefined ? requireNonNegativeInteger(input.margin, "margin") : 16;
    const position = normalizeOverlayPosition(input.position);
    const overlayWidth = input.width !== undefined ? requirePositiveInteger(input.width, "width") : undefined;
    const format = normalizeVideoExtension(extname(input.inputPath).replace(/^\./, "") || "mp4");
    const outputPath = resolveEditorOutputPath({
      inputPath: input.inputPath,
      output: input.output,
      suffix: "overlayed",
      extension: format,
    });
    const overlayFilter = overlayWidth
      ? `[1:v]scale=${overlayWidth}:-1[overlay];[0:v][overlay]overlay=${buildOverlayPosition(position, margin)}[v]`
      : `[0:v][1:v]overlay=${buildOverlayPosition(position, margin)}[v]`;

    const resolvedOutput = await runFfmpegEdit({
      inputPath: input.inputPath,
      outputPath,
      args: [
        "-i",
        "{input}",
        "-i",
        overlayPath,
        "-filter_complex",
        overlayFilter,
        "-map",
        "[v]",
        "-map",
        "0:a?",
        ...buildVideoCodecArgs(format, 21, "medium"),
        "{output}",
      ],
    });

    return this.buildResult({
      action: "overlay-image",
      message: `Saved overlaid video to ${resolvedOutput}.`,
      data: {
        inputPath: input.inputPath,
        overlayPath,
        outputPath: resolvedOutput,
        position,
        margin,
        width: overlayWidth ?? null,
      },
    });
  }

  async overlayText(input: VideoOverlayTextInput): Promise<AdapterActionResult> {
    const margin = input.margin !== undefined ? requireNonNegativeInteger(input.margin, "margin") : 24;
    const fontSize = input.fontSize !== undefined ? requirePositiveInteger(input.fontSize, "fontSize") : 48;
    const position = normalizeTextOverlayPosition(input.position);
    const color = normalizeFfmpegColor(input.color, "white");
    const box = input.box ?? true;
    const boxColor = normalizeFfmpegColor(input.boxColor, "black");
    const boxOpacity = clampNumber(toNumber(input.boxOpacity) ?? 0.45, 0, 1);
    const format = normalizeVideoExtension(extname(input.inputPath).replace(/^\./, "") || "mp4");
    const outputPath = resolveEditorOutputPath({
      inputPath: input.inputPath,
      output: input.output,
      suffix: "text-overlay",
      extension: format,
    });

    const drawtextFilter = [
      `drawtext=text='${escapeDrawtextText(input.text)}'`,
      `fontsize=${fontSize}`,
      `fontcolor=${color}`,
      `x=${buildDrawtextX(position, margin)}`,
      `y=${buildDrawtextY(position, margin)}`,
      `box=${box ? 1 : 0}`,
      `boxcolor=${boxColor}@${boxOpacity}`,
      "boxborderw=12",
    ].join(":");

    const resolvedOutput = await runFfmpegEdit({
      inputPath: input.inputPath,
      outputPath,
      args: ["-i", "{input}", "-vf", drawtextFilter, ...buildVideoCodecArgs(format, 21, "medium"), "{output}"],
    });

    return this.buildResult({
      action: "overlay-text",
      message: `Saved text-overlay video to ${resolvedOutput}.`,
      data: {
        inputPath: input.inputPath,
        outputPath: resolvedOutput,
        text: input.text,
        position,
        margin,
        fontSize,
        color,
        box,
        boxColor,
        boxOpacity,
      },
    });
  }

  async audioReplace(input: VideoAudioReplaceInput): Promise<AdapterActionResult> {
    const audioPath = await assertLocalInputFile(input.audioPath);
    const format = normalizeVideoExtension(extname(input.inputPath).replace(/^\./, "") || "mp4");
    const outputPath = resolveEditorOutputPath({
      inputPath: input.inputPath,
      output: input.output,
      suffix: "audio-replaced",
      extension: format,
    });

    const resolvedOutput = await runFfmpegEdit({
      inputPath: input.inputPath,
      outputPath,
      args: [
        "-i",
        "{input}",
        "-i",
        audioPath,
        "-map",
        "0:v:0",
        "-map",
        "1:a:0",
        "-c:v",
        "copy",
        "-c:a",
        format === "webm" ? "libopus" : "aac",
        ...(format === "webm" ? ["-b:a", "128k"] : ["-b:a", "192k"]),
        "-shortest",
        ...(format === "mp4" ? ["-movflags", "+faststart"] : []),
        "{output}",
      ],
    });

    return this.buildResult({
      action: "audio-replace",
      message: `Replaced video audio in ${resolvedOutput}.`,
      data: {
        inputPath: input.inputPath,
        audioPath,
        outputPath: resolvedOutput,
        format,
      },
    });
  }

  async frameExtract(input: VideoFrameExtractInput): Promise<AdapterActionResult> {
    const fps = clampNumber(Math.round(toNumber(input.fps) ?? 1), 1, 120);
    const format = normalizeFrameFormat(input.format ?? "png");
    const resolvedInput = await assertLocalInputFile(input.inputPath);
    const outputDir = resolve(input.outputDir ?? parse(resolvedInput).dir);
    const prefix = normalizePrefix(input.prefix ?? basename(resolvedInput, extname(resolvedInput)) ?? "frame");
    const outputPattern = join(outputDir, `${prefix}.frame-%06d.${format}`);

    const resolvedOutput = await runFfmpegEdit({
      inputPath: input.inputPath,
      outputPath: outputPattern,
      args: [
        ...(input.start ? ["-ss", input.start] : []),
        "-i",
        "{input}",
        ...(input.duration ? ["-t", input.duration] : []),
        "-vf",
        `fps=${fps}`,
        ...(format === "jpg" || format === "jpeg" ? ["-q:v", "2"] : []),
        ...(format === "webp" ? ["-compression_level", "6"] : []),
        outputPattern,
      ],
    });

    return this.buildResult({
      action: "frame-extract",
      message: `Extracted frames into ${outputDir}.`,
      data: {
        inputPath: input.inputPath,
        outputDir,
        outputPattern: resolvedOutput,
        prefix,
        format,
        fps,
        start: input.start ?? null,
        duration: input.duration ?? null,
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

  async resize(input: VideoResizeInput): Promise<AdapterActionResult> {
    const width = input.width !== undefined ? requirePositiveInteger(input.width, "width") : undefined;
    const height = input.height !== undefined ? requirePositiveInteger(input.height, "height") : undefined;
    if (!width && !height) {
      throw new AutoCliError("EDITOR_INVALID_ARGUMENT", "Resize needs at least one of --width or --height.");
    }

    const format = normalizeVideoExtension(extname(input.inputPath).replace(/^\./, "") || "mp4");
    const outputPath = resolveEditorOutputPath({
      inputPath: input.inputPath,
      output: input.output,
      suffix: "resized",
      extension: format,
    });

    const resolvedOutput = await runFfmpegEdit({
      inputPath: input.inputPath,
      outputPath,
      args: [
        "-i",
        "{input}",
        "-vf",
        buildVideoScaleFilter(width, height),
        ...buildVideoCodecArgs(format, 21, "medium"),
        "{output}",
      ],
    });

    return this.buildResult({
      action: "resize",
      message: `Saved resized video to ${resolvedOutput}.`,
      data: {
        inputPath: input.inputPath,
        outputPath: resolvedOutput,
        width: width ?? null,
        height: height ?? null,
      },
    });
  }

  async crop(input: VideoCropInput): Promise<AdapterActionResult> {
    const width = requirePositiveInteger(input.width, "width");
    const height = requirePositiveInteger(input.height, "height");
    const x = input.x !== undefined ? requireNonNegativeInteger(input.x, "x") : 0;
    const y = input.y !== undefined ? requireNonNegativeInteger(input.y, "y") : 0;
    const format = normalizeVideoExtension(extname(input.inputPath).replace(/^\./, "") || "mp4");
    const outputPath = resolveEditorOutputPath({
      inputPath: input.inputPath,
      output: input.output,
      suffix: "cropped",
      extension: format,
    });

    const resolvedOutput = await runFfmpegEdit({
      inputPath: input.inputPath,
      outputPath,
      args: [
        "-i",
        "{input}",
        "-vf",
        `crop=${width}:${height}:${x}:${y}`,
        ...buildVideoCodecArgs(format, 21, "medium"),
        "{output}",
      ],
    });

    return this.buildResult({
      action: "crop",
      message: `Saved cropped video to ${resolvedOutput}.`,
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

  async extractAudio(input: VideoExtractAudioInput): Promise<AdapterActionResult> {
    const format = normalizeAudioExtension(input.to || "mp3");
    const outputPath = resolveEditorOutputPath({
      inputPath: input.inputPath,
      output: input.output,
      suffix: "audio",
      extension: format,
    });

    const audioArgs = buildAudioEncodeArgs(format);
    const resolvedOutput = await runFfmpegEdit({
      inputPath: input.inputPath,
      outputPath,
      args: ["-i", "{input}", "-vn", ...audioArgs, "{output}"],
    });

    return this.buildResult({
      action: "extract-audio",
      message: `Extracted audio to ${resolvedOutput}.`,
      data: {
        inputPath: input.inputPath,
        outputPath: resolvedOutput,
        format,
      },
    });
  }

  async mute(input: VideoMuteInput): Promise<AdapterActionResult> {
    const format = normalizeVideoExtension(extname(input.inputPath).replace(/^\./, "") || "mp4");
    const outputPath = resolveEditorOutputPath({
      inputPath: input.inputPath,
      output: input.output,
      suffix: "muted",
      extension: format,
    });

    const resolvedOutput = await runFfmpegEdit({
      inputPath: input.inputPath,
      outputPath,
      args: [
        "-i",
        "{input}",
        "-an",
        "-c:v",
        "libx264",
        "-preset",
        "medium",
        "-crf",
        "21",
        "-pix_fmt",
        "yuv420p",
        ...(format === "mp4" ? ["-movflags", "+faststart"] : []),
        "{output}",
      ],
    });

    return this.buildResult({
      action: "mute",
      message: `Saved muted video to ${resolvedOutput}.`,
      data: {
        inputPath: input.inputPath,
        outputPath: resolvedOutput,
      },
    });
  }

  async gif(input: VideoGifInput): Promise<AdapterActionResult> {
    const fps = clampNumber(Math.round(toNumber(input.fps) ?? 12), 1, 30);
    const width = input.width !== undefined ? requirePositiveInteger(input.width, "width") : 480;
    const outputPath = resolveEditorOutputPath({
      inputPath: input.inputPath,
      output: input.output,
      suffix: "gif",
      extension: "gif",
    });

    const filter = `fps=${fps},scale=${width}:-1:flags=lanczos`;
    const args = [
      ...(input.start ? ["-ss", input.start] : []),
      "-i",
      "{input}",
      ...(input.duration ? ["-t", input.duration] : []),
      "-vf",
      filter,
      "{output}",
    ];

    const resolvedOutput = await runFfmpegEdit({
      inputPath: input.inputPath,
      outputPath,
      args,
    });

    return this.buildResult({
      action: "gif",
      message: `Saved GIF to ${resolvedOutput}.`,
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

  async concat(input: VideoConcatInput): Promise<AdapterActionResult> {
    if (input.inputPaths.length < 2) {
      throw new AutoCliError("EDITOR_INVALID_ARGUMENT", "Concat needs at least two input video paths.", {
        details: {
          inputCount: input.inputPaths.length,
        },
      });
    }

    const resolvedInputs = await Promise.all(input.inputPaths.map((nextPath) => assertLocalInputFile(nextPath)));
    const format = normalizeVideoExtension(extname(resolvedInputs[0] ?? "").replace(/^\./, "") || "mp4");
    const outputPath = resolveEditorOutputPath({
      inputPath: resolvedInputs[0]!,
      output: input.output,
      suffix: "concat",
      extension: format,
    });
    const tempDir = await mkdtemp(join(tmpdir(), "autocli-editor-concat-"));
    const listPath = join(tempDir, "inputs.txt");

    try {
      await writeFile(listPath, resolvedInputs.map((nextPath) => `file '${escapeFfmpegConcatPath(nextPath)}'`).join("\n"), "utf8");
      const resolvedOutput = await runFfmpegEdit({
        inputPath: resolvedInputs[0]!,
        outputPath,
        args: [
          "-f",
          "concat",
          "-safe",
          "0",
          "-i",
          listPath,
          ...buildVideoCodecArgs(format, 21, "medium"),
          "{output}",
        ],
      });

      return this.buildResult({
        action: "concat",
        message: `Saved concatenated video to ${resolvedOutput}.`,
        data: {
          inputPaths: resolvedInputs,
          outputPath: resolvedOutput,
        },
      });
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  }

  async subtitleBurn(input: VideoSubtitleBurnInput): Promise<AdapterActionResult> {
    const subtitlePath = await assertLocalInputFile(input.subtitlePath);
    const format = normalizeVideoExtension(extname(input.inputPath).replace(/^\./, "") || "mp4");
    const outputPath = resolveEditorOutputPath({
      inputPath: input.inputPath,
      output: input.output,
      suffix: "subtitled",
      extension: format,
    });

    const subtitleFilter = `subtitles='${escapeSubtitleFilterPath(subtitlePath)}'`;
    const resolvedOutput = await runFfmpegEdit({
      inputPath: input.inputPath,
      outputPath,
      args: [
        "-i",
        "{input}",
        "-vf",
        subtitleFilter,
        ...buildVideoCodecArgs(format, 21, "medium"),
        "{output}",
      ],
    });

    return this.buildResult({
      action: "subtitle-burn",
      message: `Saved subtitled video to ${resolvedOutput}.`,
      data: {
        inputPath: input.inputPath,
        subtitlePath,
        outputPath: resolvedOutput,
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

function parseFlexibleDuration(value: string, label: string): number {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new AutoCliError("EDITOR_INVALID_ARGUMENT", `${label} is required.`);
  }

  const numeric = Number(trimmed);
  if (Number.isFinite(numeric) && numeric > 0) {
    return numeric;
  }

  const match = /^(?:(\d+):)?(\d{1,2}):(\d{1,2}(?:\.\d+)?)$/.exec(trimmed);
  if (!match) {
    throw new AutoCliError("EDITOR_INVALID_ARGUMENT", `${label} must be seconds or HH:MM:SS(.ms).`, {
      details: {
        label,
        value,
      },
    });
  }

  const hours = Number(match[1] ?? "0");
  const minutes = Number(match[2] ?? "0");
  const seconds = Number(match[3] ?? "0");
  const total = (hours * 3600) + (minutes * 60) + seconds;
  if (!Number.isFinite(total) || total <= 0) {
    throw new AutoCliError("EDITOR_INVALID_ARGUMENT", `${label} must be greater than zero.`, {
      details: {
        label,
        value,
      },
    });
  }

  return total;
}

function requirePositiveNumber(value: number | string, label: string): number {
  const parsed = toNumber(value);
  if (parsed === undefined || !Number.isFinite(parsed) || parsed <= 0) {
    throw new AutoCliError("EDITOR_INVALID_ARGUMENT", `${label} must be a positive number.`, {
      details: {
        label,
        value,
      },
    });
  }

  return parsed;
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

function buildVideoScaleFilter(width?: number, height?: number): string {
  if (width && height) {
    return `scale=${width}:${height}`;
  }

  if (width) {
    return `scale=${width}:-2`;
  }

  if (height) {
    return `scale=-2:${height}`;
  }

  return "scale=iw:ih";
}

export function buildSpeedVideoFilter(factor: number): string {
  return `setpts=${formatFilterNumber(1 / factor)}*PTS`;
}

export function buildAtempoChain(factor: number): string {
  const parts: string[] = [];
  let remaining = factor;

  while (remaining > 2) {
    parts.push("atempo=2");
    remaining /= 2;
  }

  while (remaining < 0.5) {
    parts.push("atempo=0.5");
    remaining /= 0.5;
  }

  parts.push(`atempo=${formatFilterNumber(remaining)}`);
  return parts.join(",");
}

function normalizeOverlayPosition(value: string | undefined): "top-left" | "top-right" | "bottom-left" | "bottom-right" | "center" {
  const normalized = value?.trim().toLowerCase() || "bottom-right";
  if (normalized === "top-left" || normalized === "top-right" || normalized === "bottom-left" || normalized === "bottom-right" || normalized === "center") {
    return normalized;
  }

  throw new AutoCliError("EDITOR_INVALID_ARGUMENT", `Unsupported overlay position "${value}".`, {
    details: {
      supportedPositions: ["top-left", "top-right", "bottom-left", "bottom-right", "center"],
    },
  });
}

function normalizeTextOverlayPosition(
  value: string | undefined,
): "top-left" | "top-right" | "bottom-left" | "bottom-right" | "center" | "top-center" | "bottom-center" {
  const normalized = value?.trim().toLowerCase() || "bottom-center";
  if (
    normalized === "top-left" ||
    normalized === "top-right" ||
    normalized === "bottom-left" ||
    normalized === "bottom-right" ||
    normalized === "center" ||
    normalized === "top-center" ||
    normalized === "bottom-center"
  ) {
    return normalized;
  }

  throw new AutoCliError("EDITOR_INVALID_ARGUMENT", `Unsupported text position "${value}".`, {
    details: {
      supportedPositions: [
        "top-left",
        "top-right",
        "bottom-left",
        "bottom-right",
        "center",
        "top-center",
        "bottom-center",
      ],
    },
  });
}

export function buildOverlayPosition(position: "top-left" | "top-right" | "bottom-left" | "bottom-right" | "center", margin: number): string {
  switch (position) {
    case "top-left":
      return `${margin}:${margin}`;
    case "top-right":
      return `main_w-overlay_w-${margin}:${margin}`;
    case "bottom-left":
      return `${margin}:main_h-overlay_h-${margin}`;
    case "center":
      return `(main_w-overlay_w)/2:(main_h-overlay_h)/2`;
    case "bottom-right":
    default:
      return `main_w-overlay_w-${margin}:main_h-overlay_h-${margin}`;
  }
}

function buildDrawtextX(
  position: "top-left" | "top-right" | "bottom-left" | "bottom-right" | "center" | "top-center" | "bottom-center",
  margin: number,
): string {
  switch (position) {
    case "top-left":
    case "bottom-left":
      return String(margin);
    case "top-right":
    case "bottom-right":
      return `w-text_w-${margin}`;
    case "top-center":
    case "bottom-center":
    case "center":
      return "(w-text_w)/2";
  }
}

function buildDrawtextY(
  position: "top-left" | "top-right" | "bottom-left" | "bottom-right" | "center" | "top-center" | "bottom-center",
  margin: number,
): string {
  switch (position) {
    case "top-left":
    case "top-right":
    case "top-center":
      return String(margin);
    case "bottom-left":
    case "bottom-right":
    case "bottom-center":
      return `h-text_h-${margin}`;
    case "center":
      return "(h-text_h)/2";
  }
}

function escapeDrawtextText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/:/g, "\\:")
    .replace(/'/g, "\\'")
    .replace(/%/g, "\\%")
    .replace(/\n/g, "\\n");
}

function normalizeFfmpegColor(value: string | undefined, fallback: string): string {
  const normalized = value?.trim() || fallback;
  if (/^#[0-9a-f]{6}$/i.test(normalized)) {
    return `0x${normalized.slice(1)}`;
  }
  if (/^0x[0-9a-f]{6}$/i.test(normalized) || /^[a-z]+$/i.test(normalized)) {
    return normalized;
  }

  throw new AutoCliError("EDITOR_INVALID_ARGUMENT", `Unsupported color value "${value}".`, {
    details: {
      supportedFormats: ["#RRGGBB", "0xRRGGBB", "white", "black", "yellow"],
    },
  });
}

export function normalizeFrameFormat(value: string): "png" | "jpg" | "jpeg" | "webp" {
  const normalized = value.trim().toLowerCase();
  if (normalized === "png" || normalized === "jpg" || normalized === "jpeg" || normalized === "webp") {
    return normalized;
  }

  throw new AutoCliError("EDITOR_INVALID_ARGUMENT", `Unsupported frame format "${value}".`, {
    details: {
      supportedFormats: ["png", "jpg", "jpeg", "webp"],
    },
  });
}

function formatFilterNumber(value: number): string {
  return Number(value.toFixed(6)).toString();
}

function formatSecondsForFfmpeg(value: number): string {
  return Number(value.toFixed(3)).toString();
}

function normalizePrefix(value: string): string {
  const normalized = value.trim().replace(/[^a-z0-9._-]+/gi, "-").replace(/^-+|-+$/g, "");
  return normalized || "frame";
}

function normalizeAudioExtension(value: string): "mp3" | "wav" | "m4a" | "aac" | "flac" {
  const normalized = value.trim().toLowerCase();
  if (normalized === "mp3" || normalized === "wav" || normalized === "m4a" || normalized === "aac" || normalized === "flac") {
    return normalized;
  }

  throw new AutoCliError("EDITOR_INVALID_ARGUMENT", `Unsupported audio format "${value}".`, {
    details: {
      supportedFormats: ["mp3", "wav", "m4a", "aac", "flac"],
    },
  });
}

function buildAudioEncodeArgs(format: "mp3" | "wav" | "m4a" | "aac" | "flac"): string[] {
  switch (format) {
    case "wav":
      return ["-c:a", "pcm_s16le"];
    case "flac":
      return ["-c:a", "flac"];
    case "aac":
      return ["-c:a", "aac", "-b:a", "192k"];
    case "m4a":
      return ["-c:a", "aac", "-b:a", "192k"];
    case "mp3":
    default:
      return ["-c:a", "libmp3lame", "-q:a", "2"];
  }
}

function escapeFfmpegConcatPath(value: string): string {
  return value.replace(/'/g, "'\\''");
}

function escapeSubtitleFilterPath(value: string): string {
  return resolve(value).replace(/\\/g, "/").replace(/:/g, "\\:").replace(/'/g, "\\'");
}

async function runVideoAnalysis(input: {
  inputPath: string;
  args: readonly string[];
}): Promise<string> {
  const resolvedInput = await assertLocalInputFile(input.inputPath);

  return new Promise<string>((resolvePromise, rejectPromise) => {
    const child = spawn(process.env.AUTOCLI_FFMPEG_BIN || "ffmpeg", ["-hide_banner", "-nostats", "-loglevel", "info", "-i", resolvedInput, ...input.args], {
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stderr = "";

    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });

    child.on("error", (error) => {
      rejectPromise(
        new AutoCliError("FFMPEG_NOT_AVAILABLE", "ffmpeg is not installed or not available in PATH.", {
          details: {
            command: process.env.AUTOCLI_FFMPEG_BIN || "ffmpeg",
          },
          cause: error,
        }),
      );
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolvePromise(stderr);
        return;
      }

      rejectPromise(
        new AutoCliError("EDITOR_COMMAND_FAILED", `ffmpeg exited with code ${code}.`, {
          details: {
            command: process.env.AUTOCLI_FFMPEG_BIN || "ffmpeg",
            args: input.args,
            stderr: stderr.trim() || null,
          },
        }),
      );
    });
  });
}

function parseSceneDetectLog(log: string): Array<{
  index: number;
  timestampSeconds: number;
  timestamp: string;
  score: number | null;
  frame: number | null;
}> {
  const sceneChanges: Array<{
    index: number;
    timestampSeconds: number;
    timestamp: string;
    score: number | null;
    frame: number | null;
  }> = [];
  const seenTimestamps = new Set<number>();
  let currentFrame: number | null = null;
  let currentScore: number | null = null;

  for (const line of log.split(/\r?\n/)) {
    const frameMatch = /frame:(\d+)/.exec(line);
    if (frameMatch) {
      currentFrame = Number(frameMatch[1]);
    }

    const scoreMatch = /lavfi\.scd\.score=([0-9]+(?:\.[0-9]+)?)/.exec(line);
    if (scoreMatch) {
      currentScore = Number(scoreMatch[1]);
    }

    const timeMatch = /lavfi\.scd\.time=([0-9]+(?:\.[0-9]+)?)/.exec(line);
    if (!timeMatch) {
      continue;
    }

    const timestampSeconds = Number(timeMatch[1]);
    if (!Number.isFinite(timestampSeconds)) {
      continue;
    }

    const rounded = Number(timestampSeconds.toFixed(3));
    if (seenTimestamps.has(rounded)) {
      continue;
    }

    seenTimestamps.add(rounded);
    sceneChanges.push({
      index: sceneChanges.length + 1,
      timestampSeconds,
      timestamp: formatSceneTimestamp(timestampSeconds),
      score: currentScore !== null && Number.isFinite(currentScore) ? currentScore : null,
      frame: currentFrame !== null && Number.isFinite(currentFrame) ? currentFrame : null,
    });
  }

  return sceneChanges;
}

function buildSceneSegments(
  sceneChanges: Array<{
    index: number;
    timestampSeconds: number;
    timestamp: string;
    score: number | null;
    frame: number | null;
  }>,
  durationSeconds: number | undefined,
): Array<{
  index: number;
  startSeconds: number;
  start: string;
  endSeconds: number | null;
  end: string | null;
  durationSeconds: number | null;
}> {
  const boundaries = [0, ...sceneChanges.map((scene) => scene.timestampSeconds)];
  if (typeof durationSeconds === "number" && Number.isFinite(durationSeconds) && durationSeconds > 0) {
    boundaries.push(durationSeconds);
  }

  const segments: Array<{
    index: number;
    startSeconds: number;
    start: string;
    endSeconds: number | null;
    end: string | null;
    durationSeconds: number | null;
  }> = [];

  for (let index = 0; index < boundaries.length - 1; index += 1) {
    const startSeconds = boundaries[index]!;
    const endSeconds = boundaries[index + 1] ?? null;
    segments.push({
      index: index + 1,
      startSeconds,
      start: formatSceneTimestamp(startSeconds),
      endSeconds,
      end: endSeconds !== null ? formatSceneTimestamp(endSeconds) : null,
      durationSeconds: endSeconds !== null ? Math.max(0, endSeconds - startSeconds) : null,
    });
  }

  if (segments.length === 0) {
    const hasDuration = typeof durationSeconds === "number" && Number.isFinite(durationSeconds) && durationSeconds > 0;
    segments.push({
      index: 1,
      startSeconds: 0,
      start: formatSceneTimestamp(0),
      endSeconds: hasDuration ? durationSeconds : null,
      end: hasDuration ? formatSceneTimestamp(durationSeconds) : null,
      durationSeconds: hasDuration ? Math.max(0, durationSeconds) : null,
    });
  }

  return segments;
}

function formatSceneTimestamp(seconds: number): string {
  const totalMillis = Math.max(0, Math.round(seconds * 1000));
  const hours = Math.floor(totalMillis / 3_600_000);
  const minutes = Math.floor((totalMillis % 3_600_000) / 60_000);
  const secs = Math.floor((totalMillis % 60_000) / 1000);
  const millis = totalMillis % 1000;

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}.${String(millis).padStart(3, "0")}`;
}
