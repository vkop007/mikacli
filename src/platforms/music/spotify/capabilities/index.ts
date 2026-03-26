import { spotifyAdapter } from "../adapter.js";
import { createSpotifyLoginCapability } from "./login.js";
import {
  createSpotifyPlaylistAddCapability,
  createSpotifyPlaylistCreateCapability,
  createSpotifyPlaylistRemoveCapability,
  createSpotifyPlaylistsCapability,
  createSpotifyPlaylistTracksCapability,
  createSpotifyRecentCapability,
  createSpotifySavedTracksCapability,
  createSpotifyTopCapability,
} from "./library.js";
import {
  createSpotifyDeviceCapability,
  createSpotifyDevicesCapability,
  createSpotifyNextCapability,
  createSpotifyPauseCapability,
  createSpotifyPlayCapability,
  createSpotifyPreviousCapability,
  createSpotifyQueueAddCapability,
  createSpotifyQueueCapability,
  createSpotifyRepeatCapability,
  createSpotifySeekCapability,
  createSpotifyShuffleCapability,
  createSpotifyStatusCapability,
  createSpotifyVolumeCapability,
} from "./playback.js";
import {
  createSpotifyAlbumCapability,
  createSpotifyArtistCapability,
  createSpotifyMeCapability,
  createSpotifyPlaylistCapability,
  createSpotifySearchCapability,
  createSpotifyTrackCapability,
} from "./read.js";
import {
  createSpotifyFollowArtistCapability,
  createSpotifyFollowPlaylistCapability,
  createSpotifyLikeCapability,
  createSpotifyUnfollowArtistCapability,
  createSpotifyUnfollowPlaylistCapability,
  createSpotifyUnlikeCapability,
} from "./write.js";

import type { PlatformCapability } from "../../../../core/runtime/platform-definition.js";
import type { SpotifyAdapter } from "../service.js";

export function createSpotifyCapabilities(adapter: SpotifyAdapter): readonly PlatformCapability[] {
  return [
    createSpotifyLoginCapability(adapter),
    createSpotifyMeCapability(adapter),
    createSpotifySearchCapability(adapter),
    createSpotifyTrackCapability(adapter),
    createSpotifyAlbumCapability(adapter),
    createSpotifyArtistCapability(adapter),
    createSpotifyPlaylistCapability(adapter),
    createSpotifyDevicesCapability(adapter),
    createSpotifyStatusCapability(adapter),
    createSpotifyRecentCapability(adapter),
    createSpotifyTopCapability(adapter),
    createSpotifySavedTracksCapability(adapter),
    createSpotifyPlaylistsCapability(adapter),
    createSpotifyPlaylistCreateCapability(adapter),
    createSpotifyPlaylistTracksCapability(adapter),
    createSpotifyPlaylistAddCapability(adapter),
    createSpotifyPlaylistRemoveCapability(adapter),
    createSpotifyDeviceCapability(adapter),
    createSpotifyPlayCapability(adapter),
    createSpotifyPauseCapability(adapter),
    createSpotifyNextCapability(adapter),
    createSpotifyPreviousCapability(adapter),
    createSpotifySeekCapability(adapter),
    createSpotifyVolumeCapability(adapter),
    createSpotifyShuffleCapability(adapter),
    createSpotifyRepeatCapability(adapter),
    createSpotifyQueueCapability(adapter),
    createSpotifyQueueAddCapability(adapter),
    createSpotifyLikeCapability(adapter),
    createSpotifyUnlikeCapability(adapter),
    createSpotifyFollowArtistCapability(adapter),
    createSpotifyUnfollowArtistCapability(adapter),
    createSpotifyFollowPlaylistCapability(adapter),
    createSpotifyUnfollowPlaylistCapability(adapter),
  ];
}

export const spotifyCapabilities: readonly PlatformCapability[] = createSpotifyCapabilities(spotifyAdapter);
