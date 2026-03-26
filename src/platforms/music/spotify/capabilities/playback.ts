import { createAdapterActionCapability } from "../../../../core/runtime/capability-helpers.js";
import { printSpotifyDevicesResult, printSpotifyPlaybackStatusResult, printSpotifyQueueResult } from "../output.js";
import {
  parseSpotifyBooleanState,
  parseSpotifyEngineOption,
  parseSpotifySearchTypeOption,
} from "../options.js";

import type { SpotifyAdapter } from "../service.js";

const spotifyEngineOption = {
  flags: "--engine <mode>",
  description: "Spotify playback engine: auto, connect, or web (default: auto)",
  parser: parseSpotifyEngineOption,
} as const;

export function createSpotifyDevicesCapability(adapter: SpotifyAdapter) {
  return createAdapterActionCapability({
    id: "devices",
    command: "devices",
    description: "List available Spotify Connect devices for the saved session",
    spinnerText: "Loading Spotify devices...",
    successMessage: "Spotify devices loaded.",
    options: [spotifyEngineOption, { flags: "--account <name>", description: "Optional override for a specific saved Spotify session" }],
    action: ({ options }) =>
      adapter.devices({
        account: options.account as string | undefined,
        engine: options.engine as "auto" | "connect" | "web" | undefined,
      }),
    onSuccess: printSpotifyDevicesResult,
  });
}

export function createSpotifyStatusCapability(adapter: SpotifyAdapter) {
  return createAdapterActionCapability({
    id: "status",
    command: "status",
    description: "Show current Spotify playback state, active device, and current track",
    spinnerText: "Loading Spotify playback status...",
    successMessage: "Spotify playback status loaded.",
    options: [spotifyEngineOption, { flags: "--account <name>", description: "Optional override for a specific saved Spotify session" }],
    action: ({ options }) =>
      adapter.playbackStatus({
        account: options.account as string | undefined,
        engine: options.engine as "auto" | "connect" | "web" | undefined,
      }),
    onSuccess: printSpotifyPlaybackStatusResult,
  });
}

export function createSpotifyDeviceCapability(adapter: SpotifyAdapter) {
  return createAdapterActionCapability({
    id: "device",
    command: "device <target>",
    aliases: ["transfer"],
    description: "Transfer Spotify playback to a device id or matching device name",
    spinnerText: "Switching Spotify device...",
    successMessage: "Spotify device switched.",
    options: [
      { flags: "--play", description: "Resume playback on the destination device after transfer" },
      spotifyEngineOption,
      { flags: "--account <name>", description: "Optional override for a specific saved Spotify session" },
    ],
    action: ({ args, options }) =>
      adapter.transferPlayback({
        account: options.account as string | undefined,
        target: String(args[0] ?? ""),
        play: Boolean(options.play),
        engine: options.engine as "auto" | "connect" | "web" | undefined,
      }),
  });
}

export function createSpotifyPlayCapability(adapter: SpotifyAdapter) {
  return createAdapterActionCapability({
    id: "play",
    command: "play [target]",
    description: "Resume playback or start a Spotify track, album, artist, or playlist",
    spinnerText: "Starting Spotify playback...",
    successMessage: "Spotify playback started.",
    options: [
      { flags: "--device <target>", description: "Optional device id or name to target" },
      { flags: "--type <kind>", description: "Interpret a raw id as track, album, artist, or playlist", parser: parseSpotifySearchTypeOption },
      spotifyEngineOption,
      { flags: "--account <name>", description: "Optional override for a specific saved Spotify session" },
    ],
    action: ({ args, options }) =>
      adapter.play({
        account: options.account as string | undefined,
        target: typeof args[0] === "string" ? args[0] : undefined,
        device: options.device as string | undefined,
        type: options.type as "track" | "album" | "artist" | "playlist" | undefined,
        engine: options.engine as "auto" | "connect" | "web" | undefined,
      }),
  });
}

export function createSpotifyPauseCapability(adapter: SpotifyAdapter) {
  return createAdapterActionCapability({
    id: "pause",
    command: "pause",
    description: "Pause Spotify playback on the active or chosen device",
    spinnerText: "Pausing Spotify playback...",
    successMessage: "Spotify playback paused.",
    options: [
      { flags: "--device <target>", description: "Optional device id or name to target" },
      spotifyEngineOption,
      { flags: "--account <name>", description: "Optional override for a specific saved Spotify session" },
    ],
    action: ({ options }) =>
      adapter.pause({
        account: options.account as string | undefined,
        device: options.device as string | undefined,
        engine: options.engine as "auto" | "connect" | "web" | undefined,
      }),
  });
}

export function createSpotifyNextCapability(adapter: SpotifyAdapter) {
  return createAdapterActionCapability({
    id: "next",
    command: "next",
    description: "Skip to the next Spotify track",
    spinnerText: "Skipping to the next Spotify track...",
    successMessage: "Skipped to the next Spotify track.",
    options: [
      { flags: "--device <target>", description: "Optional device id or name to target" },
      spotifyEngineOption,
      { flags: "--account <name>", description: "Optional override for a specific saved Spotify session" },
    ],
    action: ({ options }) =>
      adapter.next({
        account: options.account as string | undefined,
        device: options.device as string | undefined,
        engine: options.engine as "auto" | "connect" | "web" | undefined,
      }),
  });
}

export function createSpotifyPreviousCapability(adapter: SpotifyAdapter) {
  return createAdapterActionCapability({
    id: "previous",
    command: "previous",
    aliases: ["prev"],
    description: "Go back to the previous Spotify track",
    spinnerText: "Going to the previous Spotify track...",
    successMessage: "Moved to the previous Spotify track.",
    options: [
      { flags: "--device <target>", description: "Optional device id or name to target" },
      spotifyEngineOption,
      { flags: "--account <name>", description: "Optional override for a specific saved Spotify session" },
    ],
    action: ({ options }) =>
      adapter.previous({
        account: options.account as string | undefined,
        device: options.device as string | undefined,
        engine: options.engine as "auto" | "connect" | "web" | undefined,
      }),
  });
}

export function createSpotifySeekCapability(adapter: SpotifyAdapter) {
  return createAdapterActionCapability({
    id: "seek",
    command: "seek <position>",
    description: "Seek Spotify playback to a position in milliseconds or mm:ss",
    spinnerText: "Seeking Spotify playback...",
    successMessage: "Spotify playback position updated.",
    options: [
      { flags: "--device <target>", description: "Optional device id or name to target" },
      spotifyEngineOption,
      { flags: "--account <name>", description: "Optional override for a specific saved Spotify session" },
    ],
    action: ({ args, options }) =>
      adapter.seek({
        account: options.account as string | undefined,
        device: options.device as string | undefined,
        position: String(args[0] ?? ""),
        engine: options.engine as "auto" | "connect" | "web" | undefined,
      }),
  });
}

export function createSpotifyVolumeCapability(adapter: SpotifyAdapter) {
  return createAdapterActionCapability({
    id: "volume",
    command: "volume <percent>",
    description: "Set Spotify playback volume from 0 to 100",
    spinnerText: "Updating Spotify volume...",
    successMessage: "Spotify volume updated.",
    options: [
      { flags: "--device <target>", description: "Optional device id or name to target" },
      spotifyEngineOption,
      { flags: "--account <name>", description: "Optional override for a specific saved Spotify session" },
    ],
    action: ({ args, options }) =>
      adapter.volume({
        account: options.account as string | undefined,
        device: options.device as string | undefined,
        percent: String(args[0] ?? ""),
        engine: options.engine as "auto" | "connect" | "web" | undefined,
      }),
  });
}

export function createSpotifyShuffleCapability(adapter: SpotifyAdapter) {
  return createAdapterActionCapability({
    id: "shuffle",
    command: "shuffle <state>",
    description: "Turn Spotify shuffle on or off",
    spinnerText: "Updating Spotify shuffle state...",
    successMessage: "Spotify shuffle state updated.",
    options: [
      { flags: "--device <target>", description: "Optional device id or name to target" },
      spotifyEngineOption,
      { flags: "--account <name>", description: "Optional override for a specific saved Spotify session" },
    ],
    action: ({ args, options }) =>
      adapter.shuffle({
        account: options.account as string | undefined,
        device: options.device as string | undefined,
        state: parseSpotifyBooleanState(String(args[0] ?? "")),
        engine: options.engine as "auto" | "connect" | "web" | undefined,
      }),
  });
}

export function createSpotifyRepeatCapability(adapter: SpotifyAdapter) {
  return createAdapterActionCapability({
    id: "repeat",
    command: "repeat <state>",
    description: "Set Spotify repeat mode to off, track, or context",
    spinnerText: "Updating Spotify repeat mode...",
    successMessage: "Spotify repeat mode updated.",
    options: [
      { flags: "--device <target>", description: "Optional device id or name to target" },
      spotifyEngineOption,
      { flags: "--account <name>", description: "Optional override for a specific saved Spotify session" },
    ],
    action: ({ args, options }) =>
      adapter.repeat({
        account: options.account as string | undefined,
        device: options.device as string | undefined,
        state: String(args[0] ?? ""),
        engine: options.engine as "auto" | "connect" | "web" | undefined,
      }),
  });
}

export function createSpotifyQueueCapability(adapter: SpotifyAdapter) {
  return createAdapterActionCapability({
    id: "queue",
    command: "queue",
    description: "Show the current Spotify queue",
    spinnerText: "Loading Spotify queue...",
    successMessage: "Spotify queue loaded.",
    options: [spotifyEngineOption, { flags: "--account <name>", description: "Optional override for a specific saved Spotify session" }],
    action: ({ options }) =>
      adapter.queue({
        account: options.account as string | undefined,
        engine: options.engine as "auto" | "connect" | "web" | undefined,
      }),
    onSuccess: printSpotifyQueueResult,
  });
}

export function createSpotifyQueueAddCapability(adapter: SpotifyAdapter) {
  return createAdapterActionCapability({
    id: "queueadd",
    command: "queueadd <target>",
    aliases: ["queue-add"],
    description: "Add a Spotify track to the playback queue",
    spinnerText: "Adding Spotify track to queue...",
    successMessage: "Spotify track queued.",
    options: [
      { flags: "--device <target>", description: "Optional device id or name to target" },
      spotifyEngineOption,
      { flags: "--account <name>", description: "Optional override for a specific saved Spotify session" },
    ],
    action: ({ args, options }) =>
      adapter.queueAdd({
        account: options.account as string | undefined,
        device: options.device as string | undefined,
        target: String(args[0] ?? ""),
        engine: options.engine as "auto" | "connect" | "web" | undefined,
      }),
  });
}
