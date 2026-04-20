import { getPlatformHomeUrl, getPlatformOrigin } from "../../config.js";

export const SPOTIFY_ORIGIN = getPlatformOrigin("spotify");
export const SPOTIFY_HOME = getPlatformHomeUrl("spotify");
export const SPOTIFY_API_BASE = "https://api.spotify.com/v1";
export const SPOTIFY_SERVER_TIME_ENDPOINT = `${SPOTIFY_ORIGIN}/api/server-time`;
export const SPOTIFY_TOKEN_ENDPOINT = `${SPOTIFY_ORIGIN}/api/token`;
export const SPOTIFY_CLIENT_TOKEN_ENDPOINT = "https://clienttoken.spotify.com/v1/clienttoken";
export const SPOTIFY_PATHFINDER_ENDPOINT = "https://api-partner.spotify.com/pathfinder/v1/query";
export const SPOTIFY_CONNECT_STATE_BASE = "https://gue1-spclient.spotify.com/connect-state/v1";
export const SPOTIFY_TRACK_PLAYBACK_BASE = "https://gue1-spclient.spotify.com/track-playback/v1";
export const SPOTIFY_DEALER_URL = "wss://dealer.spotify.com/";
export const SPOTIFY_APP_PLATFORM = "WebPlayer";
export const SPOTIFY_CONNECT_VERSION = "harmony:4.43.2-a61ecaf5";
export const SPOTIFY_CONNECT_DEVICE_NAME = "MikaCLI";
export const SPOTIFY_CONNECT_DEVICE_MODEL = "web_player";
export const SPOTIFY_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36";
