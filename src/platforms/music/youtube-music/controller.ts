import { constants } from "node:fs";
import { access, readFile, unlink, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";

import { ensureParentDirectory, getCachePath } from "../../../config.js";
import { MikaCliError } from "../../../errors.js";

export interface YouTubeMusicControllerQueueItem {
  id: string;
  title: string;
  url: string;
  subtitle?: string;
  detail?: string;
  duration?: string;
  durationMs?: number;
  thumbnailUrl?: string;
}

export interface YouTubeMusicControllerState {
  version: 1;
  updatedAt: string;
  mode: "stopped" | "playing" | "paused";
  queue: YouTubeMusicControllerQueueItem[];
  currentIndex: number;
  currentPid?: number;
  startedAt?: string;
  pausedAt?: string;
  basePositionMs: number;
}

const CONTROLLER_STATE_PATH = getCachePath("youtube-music", "controller.json");

export function createEmptyYouTubeMusicControllerState(): YouTubeMusicControllerState {
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    mode: "stopped",
    queue: [],
    currentIndex: 0,
    basePositionMs: 0,
  };
}

export async function loadYouTubeMusicControllerState(): Promise<YouTubeMusicControllerState> {
  await access(CONTROLLER_STATE_PATH, constants.F_OK).catch(() => undefined);

  try {
    const raw = await readFile(CONTROLLER_STATE_PATH, "utf8");
    const parsed = JSON.parse(raw) as Partial<YouTubeMusicControllerState>;
    if (
      parsed &&
      parsed.version === 1 &&
      Array.isArray(parsed.queue) &&
      typeof parsed.currentIndex === "number" &&
      typeof parsed.basePositionMs === "number" &&
      (parsed.mode === "stopped" || parsed.mode === "playing" || parsed.mode === "paused")
    ) {
      return {
        version: 1,
        updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : new Date().toISOString(),
        mode: parsed.mode,
        queue: parsed.queue.filter(
          (item): item is YouTubeMusicControllerQueueItem =>
            Boolean(item && typeof item === "object" && typeof item.id === "string" && typeof item.title === "string" && typeof item.url === "string"),
        ),
        currentIndex: parsed.currentIndex,
        currentPid: typeof parsed.currentPid === "number" ? parsed.currentPid : undefined,
        startedAt: typeof parsed.startedAt === "string" ? parsed.startedAt : undefined,
        pausedAt: typeof parsed.pausedAt === "string" ? parsed.pausedAt : undefined,
        basePositionMs: parsed.basePositionMs,
      };
    }
  } catch {
    return createEmptyYouTubeMusicControllerState();
  }

  return createEmptyYouTubeMusicControllerState();
}

export async function saveYouTubeMusicControllerState(state: YouTubeMusicControllerState): Promise<void> {
  await ensureParentDirectory(CONTROLLER_STATE_PATH);
  await writeFile(
    CONTROLLER_STATE_PATH,
    `${JSON.stringify(
      {
        ...state,
        updatedAt: new Date().toISOString(),
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
}

export async function clearYouTubeMusicControllerState(): Promise<void> {
  await unlink(CONTROLLER_STATE_PATH).catch(() => undefined);
}

export function estimateYouTubeMusicPlaybackPositionMs(state: YouTubeMusicControllerState, now = Date.now()): number {
  if (state.mode !== "playing" || !state.startedAt) {
    return Math.max(0, state.basePositionMs);
  }

  const startedAt = Date.parse(state.startedAt);
  if (Number.isNaN(startedAt)) {
    return Math.max(0, state.basePositionMs);
  }

  return Math.max(0, state.basePositionMs + (now - startedAt));
}

export function isYouTubeMusicControllerProcessAlive(pid: number | undefined): boolean {
  if (!pid || !Number.isInteger(pid) || pid <= 0) {
    return false;
  }

  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export function reconcileYouTubeMusicControllerState(
  state: YouTubeMusicControllerState,
  now = Date.now(),
): YouTubeMusicControllerState {
  if (state.mode === "stopped" || !state.currentPid || isYouTubeMusicControllerProcessAlive(state.currentPid)) {
    return state;
  }

  return {
    ...state,
    mode: "stopped",
    currentPid: undefined,
    startedAt: undefined,
    pausedAt: undefined,
    basePositionMs: estimateYouTubeMusicPlaybackPositionMs(state, now),
    updatedAt: new Date(now).toISOString(),
  };
}

export function getYouTubeMusicControllerCurrentItem(
  state: YouTubeMusicControllerState,
): YouTubeMusicControllerQueueItem | undefined {
  if (state.queue.length === 0) {
    return undefined;
  }

  return state.queue.at(Math.max(0, Math.min(state.currentIndex, state.queue.length - 1)));
}

export async function spawnYouTubeMusicPlayback(streamUrl: string): Promise<number> {
  const child = spawn(
    "ffplay",
    ["-nodisp", "-autoexit", "-loglevel", "error", "-hide_banner", "-vn", streamUrl],
    {
      detached: true,
      stdio: "ignore",
    },
  );

  child.on("error", () => undefined);
  child.unref();

  if (!child.pid) {
    throw new MikaCliError("PROCESS_FAILED", "ffplay did not return a process id.");
  }

  return child.pid;
}

export async function stopYouTubeMusicPlayback(pid: number | undefined): Promise<void> {
  if (!isYouTubeMusicControllerProcessAlive(pid)) {
    return;
  }

  try {
    process.kill(pid!, "SIGTERM");
  } catch {
    return;
  }
}

export async function pauseYouTubeMusicPlayback(pid: number | undefined): Promise<void> {
  if (!isYouTubeMusicControllerProcessAlive(pid)) {
    throw new MikaCliError("YTMUSIC_CONTROLLER_NOT_RUNNING", "No active YouTube Music playback process is running.");
  }

  process.kill(pid!, "SIGSTOP");
}

export async function resumeYouTubeMusicPlayback(pid: number | undefined): Promise<void> {
  if (!isYouTubeMusicControllerProcessAlive(pid)) {
    throw new MikaCliError("YTMUSIC_CONTROLLER_NOT_RUNNING", "No paused YouTube Music playback process is available.");
  }

  process.kill(pid!, "SIGCONT");
}
