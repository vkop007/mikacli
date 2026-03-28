import { describe, expect, test } from "bun:test";

import {
  buildLetterboxdDiaryUrl,
  buildLetterboxdProfileUrl,
  normalizeLetterboxdFilmUrl,
  normalizeLetterboxdUsername,
  parseLetterboxdDiaryFeed,
} from "../helpers.js";

describe("letterboxd helpers", () => {
  test("normalizes film and profile targets", () => {
    expect(normalizeLetterboxdFilmUrl("https://letterboxd.com/film/inception/")).toBe("https://letterboxd.com/film/inception/");
    expect(normalizeLetterboxdFilmUrl("/film/inception/")).toBe("https://letterboxd.com/film/inception/");
    expect(normalizeLetterboxdUsername("darrencb")).toBe("darrencb");
    expect(normalizeLetterboxdUsername("https://letterboxd.com/darrencb/")).toBe("darrencb");
    expect(buildLetterboxdProfileUrl("darrencb")).toBe("https://letterboxd.com/darrencb/");
    expect(buildLetterboxdDiaryUrl("darrencb")).toBe("https://letterboxd.com/darrencb/rss/");
  });

  test("parses diary feeds", () => {
    const xml = `<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0" xmlns:letterboxd="https://letterboxd.com">
  <channel>
    <item>
      <title>Inception, 2010 - ★★★★½</title>
      <link>https://letterboxd.com/darrencb/film/inception/</link>
      <guid isPermaLink="false">letterboxd-review-1</guid>
      <pubDate>Sat, 28 Mar 2026 08:33:55 +1300</pubDate>
      <letterboxd:watchedDate>2026-03-27</letterboxd:watchedDate>
      <letterboxd:filmTitle>Inception</letterboxd:filmTitle>
      <letterboxd:filmYear>2010</letterboxd:filmYear>
      <letterboxd:memberRating>4.5</letterboxd:memberRating>
      <description><![CDATA[<p>A dream inside a dream.</p>]]></description>
    </item>
  </channel>
</rss>`;

    expect(parseLetterboxdDiaryFeed(xml, 5)).toEqual([
      {
        id: "letterboxd-review-1",
        title: "Inception",
        year: 2010,
        watchedDate: "2026-03-27",
        rating: "4.5 / 5",
        publishedAt: "Sat, 28 Mar 2026 08:33:55 +1300",
        summary: "A dream inside a dream.",
        url: "https://letterboxd.com/darrencb/film/inception/",
      },
    ]);
  });
});
