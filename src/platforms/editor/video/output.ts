import { printActionResult } from "../../../utils/cli.js";
import { printJson } from "../../../utils/output.js";

import type { AdapterActionResult } from "../../../types.js";

export function printVideoEditorResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);

  const data = result.data ?? {};
  const outputPath = asString(data.outputPath);
  const outputDir = asString(data.outputDir);
  const outputPattern = asString(data.outputPattern);
  const width = asNumber(data.width);
  const height = asNumber(data.height);
  const durationSeconds = asNumber(data.durationSeconds);
  const format = asString(data.format);
  const fps = asNumber(data.fps);
  const method = asString(data.method);
  const threshold = asNumber(data.threshold);
  const sceneCount = asNumber(data.sceneCount);
  const sceneTimesSeconds = Array.isArray(data.sceneTimesSeconds)
    ? data.sceneTimesSeconds.filter((value): value is number => typeof value === "number" && Number.isFinite(value))
    : [];
  const sceneChanges = asSceneChanges(data.sceneChanges);
  const sceneSegments = asSceneSegments(data.sceneSegments);
  const transition = asString(data.transition);
  const transitionDuration = asNumber(data.transitionDuration);
  const cornerRadius = asNumber(data.cornerRadius);
  const feather = asNumber(data.feather);

  if (transition) {
    console.log(`transition: ${transition}`);
  }

  if (typeof transitionDuration === "number") {
    console.log(`transition-duration: ${transitionDuration}s`);
  }

  if (typeof cornerRadius === "number") {
    console.log(`corner-radius: ${cornerRadius}px`);
  }

  if (typeof feather === "number") {
    console.log(`feather: ${feather}px`);
  }

  if (outputPath) {
    console.log(`file: ${outputPath}`);
  }

  if (outputDir) {
    console.log(`output-dir: ${outputDir}`);
  }

  if (outputPattern && outputPattern !== outputPath) {
    console.log(`pattern: ${outputPattern}`);
  }

  if (typeof width === "number" && typeof height === "number") {
    console.log(`size: ${width}x${height}`);
  }

  if (format) {
    console.log(`format: ${format}`);
  }

  if (typeof durationSeconds === "number") {
    console.log(`duration: ${durationSeconds.toFixed(2)}s`);
  }

  if (typeof fps === "number") {
    console.log(`fps: ${fps.toFixed(2)}`);
  }

  if (method) {
    console.log(`method: ${method}`);
  }

  if (typeof threshold === "number") {
    console.log(`threshold: ${threshold.toFixed(2)}`);
  }

  if (typeof sceneCount === "number") {
    console.log(`scene-count: ${sceneCount}`);
  }

  if (sceneTimesSeconds.length > 0) {
    console.log(`scene-times: ${sceneTimesSeconds.map((value) => value.toFixed(2)).join(", ")}`);
  }

  if (sceneChanges.length > 0) {
    console.log("scene-changes:");
    for (const scene of sceneChanges.slice(0, 20)) {
      const scoreLabel = typeof scene.score === "number" ? `, score ${scene.score.toFixed(2)}` : "";
      const frameLabel = typeof scene.frame === "number" ? `, frame ${scene.frame}` : "";
      console.log(`  scene ${scene.index}: ${scene.timestamp}${scoreLabel}${frameLabel}`);
    }
    if (sceneChanges.length > 20) {
      console.log(`  ... +${sceneChanges.length - 20} more`);
    }
  }

  if (sceneSegments.length > 0) {
    console.log("scene-segments:");
    for (const segment of sceneSegments.slice(0, 20)) {
      const endLabel = segment.end ?? "open-ended";
      const durationLabel = typeof segment.durationSeconds === "number" ? ` (${segment.durationSeconds.toFixed(2)}s)` : "";
      console.log(`  segment ${segment.index}: ${segment.start} -> ${endLabel}${durationLabel}`);
    }
    if (sceneSegments.length > 20) {
      console.log(`  ... +${sceneSegments.length - 20} more`);
    }
  }
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function asSceneChanges(
  value: unknown,
): Array<{
  index: number;
  timestamp: string;
  score: number | null;
  frame: number | null;
}> {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") {
      return [];
    }

    const candidate = entry as {
      index?: unknown;
      timestamp?: unknown;
      score?: unknown;
      frame?: unknown;
    };
    const index = asInteger(candidate.index);
    const timestamp = asString(candidate.timestamp);
    if (index === undefined || !timestamp) {
      return [];
    }

    return [{
      index,
      timestamp,
      score: asNullableNumber(candidate.score),
      frame: asNullableNumber(candidate.frame),
    }];
  });
}

function asSceneSegments(
  value: unknown,
): Array<{
  index: number;
  start: string;
  end: string | null;
  durationSeconds: number | null;
}> {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") {
      return [];
    }

    const candidate = entry as {
      index?: unknown;
      start?: unknown;
      end?: unknown;
      durationSeconds?: unknown;
    };
    const index = asInteger(candidate.index);
    const start = asString(candidate.start);
    if (index === undefined || !start) {
      return [];
    }

    return [{
      index,
      start,
      end: asNullableString(candidate.end),
      durationSeconds: asNullableNumber(candidate.durationSeconds),
    }];
  });
}

function asInteger(value: unknown): number | undefined {
  return typeof value === "number" && Number.isInteger(value) ? value : undefined;
}

function asNullableNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asNullableString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}
