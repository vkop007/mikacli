import { describe, expect, test } from "bun:test";

import { parseYouTubeMusicBrowseTarget } from "../../../../utils/targets.js";

describe("youtube-music targets", () => {
  test("parses album browse urls", () => {
    expect(parseYouTubeMusicBrowseTarget("https://music.youtube.com/browse/MPREb_uPJnzIv7Wl1", "album")).toEqual({
      browseId: "MPREb_uPJnzIv7Wl1",
      url: "https://music.youtube.com/browse/MPREb_uPJnzIv7Wl1",
    });
  });

  test("parses playlist urls into browse ids", () => {
    expect(parseYouTubeMusicBrowseTarget("https://music.youtube.com/playlist?list=OLAK5uy_lax_vxwiIWYVMFNX2ll6vqdErPFuXuhEk", "playlist")).toEqual({
      browseId: "VLOLAK5uy_lax_vxwiIWYVMFNX2ll6vqdErPFuXuhEk",
      canonicalTarget: "OLAK5uy_lax_vxwiIWYVMFNX2ll6vqdErPFuXuhEk",
      url: "https://music.youtube.com/playlist?list=OLAK5uy_lax_vxwiIWYVMFNX2ll6vqdErPFuXuhEk",
    });
  });

  test("parses raw artist ids", () => {
    expect(parseYouTubeMusicBrowseTarget("UCOx12K3GqOMcIeyNTNj1Z6Q", "artist")).toEqual({
      browseId: "UCOx12K3GqOMcIeyNTNj1Z6Q",
    });
  });
});
