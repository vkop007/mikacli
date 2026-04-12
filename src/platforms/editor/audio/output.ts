import { printActionResult } from "../../../utils/cli.js";
import { printJson } from "../../../utils/output.js";

import type { AdapterActionResult } from "../../../types.js";

export function printAudioResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);

  const data = result.data ?? {};
  const outputPath = asString(data.outputPath);
  const format = asString(data.format);
  const durationSeconds = asNumber(data.durationSeconds);
  const sampleRate = asNumber(data.sampleRate);
  const channels = asNumber(data.channels);
  const segmentCount = asNumber(data.segmentCount);
  const totalSilenceDurationSeconds = asNumber(data.totalSilenceDurationSeconds);
  const segments = Array.isArray(data.segments) ? data.segments.filter((value) => typeof value === "object" && value !== null) : [];
  const inputIntegratedLufs = asNumber(data.inputIntegratedLufs);
  const inputTruePeakDbfs = asNumber(data.inputTruePeakDbfs);
  const inputLoudnessRangeLu = asNumber(data.inputLoudnessRangeLu);
  const inputThresholdLufs = asNumber(data.inputThresholdLufs);
  const outputIntegratedLufs = asNumber(data.outputIntegratedLufs);
  const outputTruePeakDbfs = asNumber(data.outputTruePeakDbfs);
  const outputLoudnessRangeLu = asNumber(data.outputLoudnessRangeLu);
  const outputThresholdLufs = asNumber(data.outputThresholdLufs);
  const targetOffsetDb = asNumber(data.targetOffsetDb);

  const bgVolumeDb = asNumber(data.bgVolumeDb);
  const rate = asNumber(data.rate);
  const everySeconds = asNumber(data.everySeconds);
  const backgroundPath = asString(data.backgroundPath);
  const outputPathPattern = asString(data.outputPathPattern);

  const crossfadeSeconds = asNumber(data.crossfadeSeconds);
  const bass = asNumber(data.bass);
  const treble = asNumber(data.treble);
  const title = asString(data.title);
  const artist = asString(data.artist);

  if (outputPathPattern) {
    console.log(`output-pattern: ${outputPathPattern}`);
  }

  if (outputPath) {
    console.log(`file: ${outputPath}`);
  }

  if (backgroundPath) {
    console.log(`background: ${backgroundPath}`);
  }

  if (typeof bgVolumeDb === "number") {
    console.log(`bg-volume: ${bgVolumeDb} dB`);
  }

  if (typeof crossfadeSeconds === "number") {
    console.log(`crossfade: ${crossfadeSeconds}s`);
  }

  if (typeof bass === "number") {
    console.log(`bass: ${bass > 0 ? '+' : ''}${bass} dB`);
  }

  if (typeof treble === "number") {
    console.log(`treble: ${treble > 0 ? '+' : ''}${treble} dB`);
  }

  if (title) {
    console.log(`title: ${title}`);
  }

  if (artist) {
    console.log(`artist: ${artist}`);
  }

  if (typeof rate === "number") {
    console.log(`rate: ${rate}x`);
  }

  if (typeof everySeconds === "number") {
    console.log(`every: ${everySeconds}s`);
  }

  if (format) {
    console.log(`format: ${format}`);
  }

  if (typeof durationSeconds === "number") {
    console.log(`duration: ${durationSeconds.toFixed(2)}s`);
  }

  if (typeof sampleRate === "number") {
    console.log(`sample-rate: ${sampleRate} Hz`);
  }

  if (typeof channels === "number") {
    console.log(`channels: ${channels}`);
  }

  if (typeof segmentCount === "number") {
    console.log(`silence-segments: ${segmentCount}`);
  }

  if (typeof totalSilenceDurationSeconds === "number") {
    console.log(`silence-total: ${totalSilenceDurationSeconds.toFixed(2)}s`);
  }

  if (segments.length > 0) {
    console.log("silent-segments:");
    for (const segment of segments) {
      const item = segment as {
        startSeconds?: unknown;
        endSeconds?: unknown;
        durationSeconds?: unknown;
      };
      const startSeconds = asNumber(item.startSeconds);
      const endSeconds = asNumber(item.endSeconds);
      const durationSeconds = asNumber(item.durationSeconds);
      const parts = [
        typeof startSeconds === "number" ? `start=${startSeconds.toFixed(2)}s` : null,
        typeof endSeconds === "number" ? `end=${endSeconds.toFixed(2)}s` : null,
        typeof durationSeconds === "number" ? `duration=${durationSeconds.toFixed(2)}s` : null,
      ].filter((value): value is string => value !== null);
      console.log(`  - ${parts.join(", ")}`);
    }
  }

  if (typeof inputIntegratedLufs === "number") {
    console.log(`input-integrated-lufs: ${inputIntegratedLufs.toFixed(2)}`);
  }

  if (typeof inputTruePeakDbfs === "number") {
    console.log(`input-true-peak: ${inputTruePeakDbfs.toFixed(2)} dBFS`);
  }

  if (typeof inputLoudnessRangeLu === "number") {
    console.log(`input-lra: ${inputLoudnessRangeLu.toFixed(2)} LU`);
  }

  if (typeof inputThresholdLufs === "number") {
    console.log(`input-threshold: ${inputThresholdLufs.toFixed(2)} LUFS`);
  }

  if (typeof outputIntegratedLufs === "number") {
    console.log(`output-integrated-lufs: ${outputIntegratedLufs.toFixed(2)}`);
  }

  if (typeof outputTruePeakDbfs === "number") {
    console.log(`output-true-peak: ${outputTruePeakDbfs.toFixed(2)} dBFS`);
  }

  if (typeof outputLoudnessRangeLu === "number") {
    console.log(`output-lra: ${outputLoudnessRangeLu.toFixed(2)} LU`);
  }

  if (typeof outputThresholdLufs === "number") {
    console.log(`output-threshold: ${outputThresholdLufs.toFixed(2)} LUFS`);
  }

  if (typeof targetOffsetDb === "number") {
    console.log(`target-offset: ${targetOffsetDb.toFixed(2)} dB`);
  }
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}
