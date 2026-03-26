import { describe, expect, test } from "bun:test";

import { buildSpotifyTokenQueryParameters, generateSpotifyTotp } from "../auth.js";

describe("spotify auth helpers", () => {
  test("generates the current Spotify web-player totp", () => {
    expect(generateSpotifyTotp(',7/*F("rLJ2oxaKL^f+E1xvP@N', 1700000000000)).toBe("371599");
  });

  test("builds transport token params with server time", () => {
    expect(
      buildSpotifyTokenQueryParameters({
        reason: "transport",
        productType: "web-player",
        timestampMs: 1700000000000,
        serverTimeSeconds: 1700000015,
      }).toString(),
    ).toBe("reason=transport&productType=web-player&totp=371599&totpServer=947302&totpVer=61");
  });
});
