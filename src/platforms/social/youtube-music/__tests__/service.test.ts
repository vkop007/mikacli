import { describe, expect, test } from "bun:test";

import { youtubeMusicAdapter } from "../adapter.js";

describe("youtube-music service", () => {
  test("extracts automix related results from the watch next payload", () => {
    const response = {
      contents: {
        singleColumnMusicWatchNextResultsRenderer: {
          tabbedRenderer: {
            watchNextTabbedResultsRenderer: {
              tabs: [
                {
                  tabRenderer: {
                    content: {
                      musicQueueRenderer: {
                        content: {
                          playlistPanelRenderer: {
                            contents: [
                              {
                                playlistPanelVideoRenderer: {
                                  title: { runs: [{ text: "Dandelions" }] },
                                  navigationEndpoint: {
                                    watchEndpoint: {
                                      videoId: "HZbsLxL7GeM",
                                      watchEndpointMusicSupportedConfigs: {
                                        watchEndpointMusicConfig: {
                                          musicVideoType: "MUSIC_VIDEO_TYPE_ATV",
                                        },
                                      },
                                    },
                                  },
                                  videoId: "HZbsLxL7GeM",
                                  selected: true,
                                },
                              },
                              {
                                automixPreviewVideoRenderer: {
                                  content: {
                                    automixPlaylistVideoRenderer: {
                                      navigationEndpoint: {
                                        watchPlaylistEndpoint: {
                                          playlistId: "RDAMVMHZbsLxL7GeM",
                                        },
                                      },
                                    },
                                  },
                                },
                              },
                            ],
                          },
                        },
                      },
                    },
                  },
                },
              ],
            },
          },
        },
      },
    };

    const results = (youtubeMusicAdapter as any).extractRelatedResults(response, "HZbsLxL7GeM") as Array<Record<string, unknown>>;
    expect(results).toHaveLength(1);
    expect(results[0]?.type).toBe("playlist");
    expect(results[0]?.title).toBe("Automix");
    expect(results[0]?.url).toBe("https://music.youtube.com/playlist?list=RDAMVMHZbsLxL7GeM");
  });

  test("extracts browse sections from music shelf and carousel renderers", () => {
    const response = {
      contents: {
        singleColumnBrowseResultsRenderer: {
          tabs: [
            {
              tabRenderer: {
                content: {
                  sectionListRenderer: {
                    contents: [
                      {
                        musicShelfRenderer: {
                          title: { runs: [{ text: "Top songs" }] },
                          contents: [
                            {
                              musicResponsiveListItemRenderer: {
                                flexColumns: [
                                  {
                                    musicResponsiveListItemFlexColumnRenderer: {
                                      text: {
                                        runs: [
                                          {
                                            text: "Dandelions",
                                            navigationEndpoint: {
                                              watchEndpoint: {
                                                videoId: "HZbsLxL7GeM",
                                                watchEndpointMusicSupportedConfigs: {
                                                  watchEndpointMusicConfig: {
                                                    musicVideoType: "MUSIC_VIDEO_TYPE_ATV",
                                                  },
                                                },
                                              },
                                            },
                                          },
                                        ],
                                      },
                                    },
                                  },
                                  {
                                    musicResponsiveListItemFlexColumnRenderer: {
                                      text: {
                                        runs: [{ text: "Ruth B." }],
                                      },
                                    },
                                  },
                                ],
                                fixedColumns: [
                                  {
                                    musicResponsiveListItemFixedColumnRenderer: {
                                      text: {
                                        runs: [{ text: "3:54" }],
                                      },
                                    },
                                  },
                                ],
                              },
                            },
                          ],
                        },
                      },
                      {
                        musicCarouselShelfRenderer: {
                          header: {
                            musicCarouselShelfBasicHeaderRenderer: {
                              title: { runs: [{ text: "Albums" }] },
                            },
                          },
                          contents: [
                            {
                              musicTwoRowItemRenderer: {
                                title: { runs: [{ text: "Safe Haven" }] },
                                subtitle: { runs: [{ text: "2017" }] },
                                navigationEndpoint: {
                                  browseEndpoint: {
                                    browseId: "MPREb_uPJnzIv7Wl1",
                                    browseEndpointContextSupportedConfigs: {
                                      browseEndpointContextMusicConfig: {
                                        pageType: "MUSIC_PAGE_TYPE_ALBUM",
                                      },
                                    },
                                  },
                                },
                              },
                            },
                          ],
                        },
                      },
                    ],
                  },
                },
              },
            },
          ],
        },
      },
    };

    const sections = (youtubeMusicAdapter as any).extractBrowseSections(response, 5) as Array<{
      title?: string;
      results: Array<Record<string, unknown>>;
    }>;

    expect(sections).toHaveLength(2);
    expect(sections[0]?.title).toBe("Top songs");
    expect(sections[0]?.results[0]?.title).toBe("Dandelions");
    expect(sections[0]?.results[0]?.detail).toBe("3:54");
    expect(sections[1]?.title).toBe("Albums");
    expect(sections[1]?.results[0]?.type).toBe("album");
    expect(sections[1]?.results[0]?.id).toBe("MPREb_uPJnzIv7Wl1");
  });
});
