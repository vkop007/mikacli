import { spawn } from "node:child_process";
import { basename, extname } from "node:path";

import { AutoCliError } from "../../../errors.js";
import {
  assertLocalInputFile,
  clampNumber,
  normalizeOutputExtension,
  requirePositiveInteger,
  resolveEditorOutputPath,
  runFfmpegEdit,
  runFfprobe,
  toNumber,
} from "../shared/ffmpeg.js";

import type { AdapterActionResult, Platform } from "../../../types.js";

type AudioInfoInput = {
  inputPath: string;
};

type AudioTrimInput = {
  inputPath: string;
  start?: string;
  end?: string;
  duration?: string;
  output?: string;
};

type AudioConvertInput = {
  inputPath: string;
  to: string;
  output?: string;
};

type AudioCompressInput = {
  inputPath: string;
  bitrate?: number | string;
  output?: string;
};

type AudioNormalizeInput = {
  inputPath: string;
  loudness?: number | string;
  output?: string;
};

type AudioMergeInput = {
  inputPaths: string[];
  output?: string;
};

type AudioFadeInput = {
  inputPath: string;
  duration?: number | string;
  start?: number | string;
  output?: string;
};

type AudioTrimSilenceInput = {
  inputPath: string;
  threshold?: string;
  duration?: number | string;
  output?: string;
};

type AudioVisualizeInput = {
  inputPath: string;
  width?: number | string;
  height?: number | string;
  output?: string;
};

type AudioVolumeInput = {
  inputPath: string;
  db?: number | string;
  output?: string;
};

type AudioFormat = "mp3" | "m4a" | "aac" | "wav" | "flac" | "ogg" | "opus";

export class AudioEditorAdapter {
  readonly platform: Platform = "audio" as unknown as Platform;
  readonly displayName = "Audio Editor";

  async info(input: AudioInfoInput): Promise<AdapterActionResult> {
    const probe = await runFfprobe(input.inputPath);
    const audioStream = (probe.streams ?? []).find((entry) => entry.codec_type === "audio");

    if (!audioStream) {
      throw new AutoCliError("AUDIO_INFO_UNAVAILABLE", "Could not read audio stream information from the file.", {
        details: {
          inputPath: input.inputPath,
        },
      });
    }

    return this.buildResult({
      action: "info",
      message: `Loaded audio info for ${basename(input.inputPath)}.`,
      data: {
        inputPath: input.inputPath,
        format: probe.format?.format_name ?? null,
        codec: audioStream.codec_name ?? null,
        channels: audioStream.channels ?? null,
        sampleRate: audioStream.sample_rate ? Number(audioStream.sample_rate) : null,
        durationSeconds: toNumber(probe.format?.duration) ?? toNumber(audioStream.duration) ?? null,
        bitRate: toNumber(probe.format?.bit_rate) ?? null,
      },
    });
  }

  async trim(input: AudioTrimInput): Promise<AdapterActionResult> {
    if (!input.start && !input.end && !input.duration) {
      throw new AutoCliError("EDITOR_INVALID_ARGUMENT", "Trim needs at least one of --start, --end, or --duration.");
    }

    const format = resolvePreferredAudioFormat(input.inputPath);
    const outputPath = resolveEditorOutputPath({
      inputPath: input.inputPath,
      output: input.output,
      suffix: "trimmed",
      extension: format,
    });

    const resolvedOutput = await runFfmpegEdit({
      inputPath: input.inputPath,
      outputPath,
      args: [
        ...(input.start ? ["-ss", input.start] : []),
        ...(input.end ? ["-to", input.end] : []),
        "-i",
        "{input}",
        ...(input.duration ? ["-t", input.duration] : []),
        "-vn",
        "-c:a",
        chooseAudioCodec(format),
        ...buildAudioBitrateArgs(format, 192),
        "{output}",
      ],
    });

    return this.buildResult({
      action: "trim",
      message: `Saved trimmed audio to ${resolvedOutput}.`,
      data: {
        inputPath: input.inputPath,
        outputPath: resolvedOutput,
        start: input.start ?? null,
        end: input.end ?? null,
        duration: input.duration ?? null,
        format,
      },
    });
  }

  async convert(input: AudioConvertInput): Promise<AdapterActionResult> {
    const format = normalizeAudioExtension(input.to);
    const outputPath = resolveEditorOutputPath({
      inputPath: input.inputPath,
      output: input.output,
      suffix: "converted",
      extension: format,
    });

    const resolvedOutput = await runFfmpegEdit({
      inputPath: input.inputPath,
      outputPath,
      args: [
        "-i",
        "{input}",
        "-vn",
        "-c:a",
        chooseAudioCodec(format),
        ...buildAudioBitrateArgs(format, 192),
        "{output}",
      ],
    });

    return this.buildResult({
      action: "convert",
      message: `Converted audio to ${format} at ${resolvedOutput}.`,
      data: {
        inputPath: input.inputPath,
        outputPath: resolvedOutput,
        format,
      },
    });
  }

  async compress(input: AudioCompressInput): Promise<AdapterActionResult> {
    const sourceFormat = resolvePreferredAudioFormat(input.inputPath);
    const format = sourceFormat === "wav" || sourceFormat === "flac" ? "m4a" : sourceFormat;
    const bitrate = clampBitrate(toNumber(input.bitrate) ?? 128);
    const outputPath = resolveEditorOutputPath({
      inputPath: input.inputPath,
      output: input.output,
      suffix: "compressed",
      extension: format,
    });

    const resolvedOutput = await runFfmpegEdit({
      inputPath: input.inputPath,
      outputPath,
      args: ["-i", "{input}", "-vn", "-c:a", chooseAudioCodec(format), "-b:a", `${bitrate}k`, "{output}"],
    });

    return this.buildResult({
      action: "compress",
      message: `Saved compressed audio to ${resolvedOutput}.`,
      data: {
        inputPath: input.inputPath,
        outputPath: resolvedOutput,
        format,
        bitrateKbps: bitrate,
      },
    });
  }

  async normalize(input: AudioNormalizeInput): Promise<AdapterActionResult> {
    const loudnessValue = typeof input.loudness === "number" ? input.loudness : Number(input.loudness ?? "-16");
    const targetLufs = Number.isFinite(loudnessValue) ? -Math.abs(loudnessValue) : -16;
    const format = resolvePreferredAudioFormat(input.inputPath);
    const outputPath = resolveEditorOutputPath({
      inputPath: input.inputPath,
      output: input.output,
      suffix: "normalized",
      extension: format,
    });

    const resolvedOutput = await runFfmpegEdit({
      inputPath: input.inputPath,
      outputPath,
      args: [
        "-i",
        "{input}",
        "-vn",
        "-af",
        `loudnorm=I=${targetLufs}:TP=-1.5:LRA=11`,
        "-c:a",
        chooseAudioCodec(format),
        ...buildAudioBitrateArgs(format, 192),
        "{output}",
      ],
    });

    return this.buildResult({
      action: "normalize",
      message: `Normalized audio loudness and saved to ${resolvedOutput}.`,
      data: {
        inputPath: input.inputPath,
        outputPath: resolvedOutput,
        targetLufs,
      },
    });
  }

  async merge(input: AudioMergeInput): Promise<AdapterActionResult> {
    const inputPaths = await Promise.all(input.inputPaths.map((inputPath) => assertLocalInputFile(inputPath)));
    if (inputPaths.length < 2) {
      throw new AutoCliError("EDITOR_INVALID_ARGUMENT", "Merge needs at least two input audio files.", {
        details: {
          inputCount: inputPaths.length,
        },
      });
    }

    const format = resolvePreferredAudioFormat(inputPaths[0]!);
    const outputPath = resolveEditorOutputPath({
      inputPath: inputPaths[0]!,
      output: input.output,
      suffix: "merged",
      extension: format,
    });

    const filterComplex = [
      ...inputPaths.map(
        (_path, index) =>
          `[${index}:a]aformat=sample_fmts=fltp:channel_layouts=stereo,aresample=44100[a${index}]`,
      ),
      `${inputPaths.map((_path, index) => `[a${index}]`).join("")}concat=n=${inputPaths.length}:v=0:a=1[aout]`,
    ].join(";");

    await runAudioCommand([
      ...inputPaths.flatMap((inputPath) => ["-i", inputPath]),
      "-filter_complex",
      filterComplex,
      "-map",
      "[aout]",
      "-c:a",
      chooseAudioCodec(format),
      ...buildAudioBitrateArgs(format, 192),
      outputPath,
    ]);

    return this.buildResult({
      action: "merge",
      message: `Merged ${inputPaths.length} audio files into ${outputPath}.`,
      data: {
        inputPaths,
        inputCount: inputPaths.length,
        outputPath,
        format,
      },
    });
  }

  async fadeIn(input: AudioFadeInput): Promise<AdapterActionResult> {
    const duration = clampDurationSeconds(toNumber(input.duration) ?? 2);
    const format = resolvePreferredAudioFormat(input.inputPath);
    const outputPath = resolveEditorOutputPath({
      inputPath: input.inputPath,
      output: input.output,
      suffix: "fade-in",
      extension: format,
    });

    const resolvedOutput = await runFfmpegEdit({
      inputPath: input.inputPath,
      outputPath,
      args: [
        "-i",
        "{input}",
        "-vn",
        "-af",
        `afade=t=in:st=0:d=${duration}`,
        "-c:a",
        chooseAudioCodec(format),
        ...buildAudioBitrateArgs(format, 192),
        "{output}",
      ],
    });

    return this.buildResult({
      action: "fade-in",
      message: `Applied fade-in and saved audio to ${resolvedOutput}.`,
      data: {
        inputPath: input.inputPath,
        outputPath: resolvedOutput,
        format,
        durationSeconds: duration,
      },
    });
  }

  async fadeOut(input: AudioFadeInput): Promise<AdapterActionResult> {
    const duration = clampDurationSeconds(toNumber(input.duration) ?? 2);
    const probe = await runFfprobe(input.inputPath);
    const totalDuration = toNumber(probe.format?.duration)
      ?? toNumber((probe.streams ?? []).find((entry) => entry.codec_type === "audio")?.duration);

    if (totalDuration === undefined) {
      throw new AutoCliError("AUDIO_INFO_UNAVAILABLE", "Could not determine audio duration for fade-out.", {
        details: {
          inputPath: input.inputPath,
        },
      });
    }

    const start = input.start !== undefined
      ? clampNumber(toNumber(input.start) ?? Number.NaN, 0, totalDuration)
      : Math.max(0, totalDuration - duration);
    if (!Number.isFinite(start)) {
      throw new AutoCliError("EDITOR_INVALID_ARGUMENT", "Invalid fade-out start value.");
    }

    const format = resolvePreferredAudioFormat(input.inputPath);
    const outputPath = resolveEditorOutputPath({
      inputPath: input.inputPath,
      output: input.output,
      suffix: "fade-out",
      extension: format,
    });

    const resolvedOutput = await runFfmpegEdit({
      inputPath: input.inputPath,
      outputPath,
      args: [
        "-i",
        "{input}",
        "-vn",
        "-af",
        `afade=t=out:st=${start}:d=${duration}`,
        "-c:a",
        chooseAudioCodec(format),
        ...buildAudioBitrateArgs(format, 192),
        "{output}",
      ],
    });

    return this.buildResult({
      action: "fade-out",
      message: `Applied fade-out and saved audio to ${resolvedOutput}.`,
      data: {
        inputPath: input.inputPath,
        outputPath: resolvedOutput,
        format,
        durationSeconds: duration,
        startSeconds: start,
        totalDurationSeconds: totalDuration,
      },
    });
  }

  async trimSilence(input: AudioTrimSilenceInput): Promise<AdapterActionResult> {
    const silenceDuration = clampDurationSeconds(toNumber(input.duration) ?? 0.5);
    const threshold = input.threshold?.trim() || "-50dB";
    const format = resolvePreferredAudioFormat(input.inputPath);
    const outputPath = resolveEditorOutputPath({
      inputPath: input.inputPath,
      output: input.output,
      suffix: "trim-silence",
      extension: format,
    });

    const resolvedOutput = await runFfmpegEdit({
      inputPath: input.inputPath,
      outputPath,
      args: [
        "-i",
        "{input}",
        "-vn",
        "-af",
        `silenceremove=start_periods=1:start_duration=${silenceDuration}:start_threshold=${threshold}:stop_periods=1:stop_duration=${silenceDuration}:stop_threshold=${threshold}`,
        "-c:a",
        chooseAudioCodec(format),
        ...buildAudioBitrateArgs(format, 192),
        "{output}",
      ],
    });

    return this.buildResult({
      action: "trim-silence",
      message: `Trimmed silence and saved audio to ${resolvedOutput}.`,
      data: {
        inputPath: input.inputPath,
        outputPath: resolvedOutput,
        format,
        silenceThreshold: threshold,
        silenceDurationSeconds: silenceDuration,
      },
    });
  }

  async volume(input: AudioVolumeInput): Promise<AdapterActionResult> {
    const db = input.db !== undefined ? toNumber(input.db) : 0;
    if (db === undefined) {
      throw new AutoCliError("EDITOR_INVALID_ARGUMENT", "Invalid volume change value.");
    }

    const format = resolvePreferredAudioFormat(input.inputPath);
    const outputPath = resolveEditorOutputPath({
      inputPath: input.inputPath,
      output: input.output,
      suffix: "volume",
      extension: format,
    });

    const resolvedOutput = await runFfmpegEdit({
      inputPath: input.inputPath,
      outputPath,
      args: [
        "-i",
        "{input}",
        "-vn",
        "-af",
        `volume=${db}dB`,
        "-c:a",
        chooseAudioCodec(format),
        ...buildAudioBitrateArgs(format, 192),
        "{output}",
      ],
    });

    return this.buildResult({
      action: "volume",
      message: `Adjusted volume and saved to ${resolvedOutput}.`,
      data: {
        inputPath: input.inputPath,
        outputPath: resolvedOutput,
        format,
        db,
      },
    });
  }

  async waveform(input: AudioVisualizeInput): Promise<AdapterActionResult> {
    const width = input.width !== undefined ? requirePositiveInteger(input.width, "width") : 1280;
    const height = input.height !== undefined ? requirePositiveInteger(input.height, "height") : 320;
    const outputPath = resolveEditorOutputPath({
      inputPath: input.inputPath,
      output: input.output,
      suffix: "waveform",
      extension: "png",
    });

    const resolvedOutput = await runFfmpegEdit({
      inputPath: input.inputPath,
      outputPath,
      args: [
        "-i",
        "{input}",
        "-filter_complex",
        `[0:a]showwavespic=s=${width}x${height}:split_channels=0:colors=DodgerBlue[out]`,
        "-frames:v",
        "1",
        "-map",
        "[out]",
        "{output}",
      ],
    });

    return this.buildResult({
      action: "waveform",
      message: `Rendered a waveform image to ${resolvedOutput}.`,
      data: {
        inputPath: input.inputPath,
        outputPath: resolvedOutput,
        width,
        height,
      },
    });
  }

  async spectrogram(input: AudioVisualizeInput): Promise<AdapterActionResult> {
    const width = input.width !== undefined ? requirePositiveInteger(input.width, "width") : 1600;
    const height = input.height !== undefined ? requirePositiveInteger(input.height, "height") : 900;
    const outputPath = resolveEditorOutputPath({
      inputPath: input.inputPath,
      output: input.output,
      suffix: "spectrogram",
      extension: "png",
    });

    const resolvedOutput = await runFfmpegEdit({
      inputPath: input.inputPath,
      outputPath,
      args: [
        "-i",
        "{input}",
        "-filter_complex",
        `[0:a]showspectrumpic=s=${width}x${height}:legend=disabled:color=intensity[out]`,
        "-frames:v",
        "1",
        "-map",
        "[out]",
        "{output}",
      ],
    });

    return this.buildResult({
      action: "spectrogram",
      message: `Rendered a spectrogram image to ${resolvedOutput}.`,
      data: {
        inputPath: input.inputPath,
        outputPath: resolvedOutput,
        width,
        height,
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

export const audioEditorAdapter = new AudioEditorAdapter();

function normalizeAudioExtension(value: string): AudioFormat {
  const normalized = normalizeOutputExtension(value);
  if (["mp3", "m4a", "aac", "wav", "flac", "ogg", "opus"].includes(normalized)) {
    return normalized as AudioFormat;
  }

  throw new AutoCliError("EDITOR_INVALID_ARGUMENT", `Unsupported audio format "${value}".`, {
    details: {
      supportedFormats: ["mp3", "m4a", "aac", "wav", "flac", "ogg", "opus"],
    },
  });
}

function resolvePreferredAudioFormat(inputPath: string): AudioFormat {
  const extension = extname(inputPath).replace(/^\./, "");

  try {
    return normalizeAudioExtension(extension || "m4a");
  } catch {
    return "m4a";
  }
}

function chooseAudioCodec(format: AudioFormat): string {
  switch (format) {
    case "mp3":
      return "libmp3lame";
    case "m4a":
    case "aac":
      return "aac";
    case "wav":
      return "pcm_s16le";
    case "flac":
      return "flac";
    case "ogg":
      return "libvorbis";
    case "opus":
      return "libopus";
  }
}

function buildAudioBitrateArgs(format: AudioFormat, bitrateKbps: number): string[] {
  if (format === "m4a" || format === "aac" || format === "ogg" || format === "opus" || format === "mp3") {
    return ["-b:a", `${bitrateKbps}k`];
  }

  return [];
}

function clampBitrate(value: number): number {
  return Math.max(32, Math.min(320, Math.round(value)));
}

function clampDurationSeconds(value: number): number {
  return clampNumber(value, 0.1, 600);
}

async function runAudioCommand(args: readonly string[]): Promise<void> {
  await new Promise<void>((resolvePromise, rejectPromise) => {
    const child = spawn(process.env.AUTOCLI_FFMPEG_BIN || "ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", ...args], {
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
        resolvePromise();
        return;
      }

      rejectPromise(
        new AutoCliError("EDITOR_COMMAND_FAILED", `ffmpeg exited with code ${code}.`, {
          details: {
            command: process.env.AUTOCLI_FFMPEG_BIN || "ffmpeg",
            args,
            stderr: stderr.trim() || null,
          },
        }),
      );
    });
  });
}
