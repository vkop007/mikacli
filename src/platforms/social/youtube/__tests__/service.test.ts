import { describe, expect, test } from "bun:test";

import { youtubeAdapter } from "../adapter.js";
import { resolveYouTubeCommunityPostTarget } from "../service.js";

describe("youtube subscription params extraction", () => {
  test("extracts subscribe and unsubscribe params for the target channel from ytInitialData", () => {
    const html = `
      <html>
        <script>
          var ytInitialData = {
            "header": {
              "pageHeaderRenderer": {
                "content": {
                  "pageHeaderViewModel": {
                    "actions": {
                      "flexibleActionsViewModel": {
                        "actionsRows": [
                          {
                            "actions": [
                              {
                                "subscribeButtonViewModel": {
                                  "subscribeButtonContent": {
                                    "onTapCommand": {
                                      "innertubeCommand": {
                                        "subscribeEndpoint": {
                                          "channelIds": ["UCTARGET123"],
                                          "params": "SUBSCRIBE_TOKEN"
                                        }
                                      }
                                    }
                                  },
                                  "unsubscribeButtonContent": {
                                    "onTapCommand": {
                                      "innertubeCommand": {
                                        "signalServiceEndpoint": {
                                          "actions": [
                                            {
                                              "openPopupAction": {
                                                "popup": {
                                                  "confirmDialogRenderer": {
                                                    "confirmButton": {
                                                      "buttonRenderer": {
                                                        "serviceEndpoint": {
                                                          "unsubscribeEndpoint": {
                                                            "channelIds": ["UCTARGET123"],
                                                            "params": "UNSUBSCRIBE_TOKEN"
                                                          }
                                                        }
                                                      }
                                                    }
                                                  }
                                                }
                                              }
                                            }
                                          ]
                                        }
                                      }
                                    }
                                  }
                                }
                              }
                            ]
                          }
                        ]
                      }
                    }
                  }
                }
              }
            }
          };
        </script>
      </html>
    `;

    const adapter = youtubeAdapter as any;
    expect(adapter.extractSubscriptionMutationParams(html, "UCTARGET123", true)).toBe("SUBSCRIBE_TOKEN");
    expect(adapter.extractSubscriptionMutationParams(html, "UCTARGET123", false)).toBe("UNSUBSCRIBE_TOKEN");
    expect(adapter.extractSubscriptionMutationParams(html, "UCOTHER", true)).toBeUndefined();
  });
});

describe("youtube community post target parsing", () => {
  test("normalizes canonical and community lb URLs to a /post target", () => {
    expect(resolveYouTubeCommunityPostTarget("https://www.youtube.com/post/Ugkx30z9Hvx7V3TbwDBOc8FEbcax4HDgLma7")).toEqual({
      postId: "Ugkx30z9Hvx7V3TbwDBOc8FEbcax4HDgLma7",
      url: "https://www.youtube.com/post/Ugkx30z9Hvx7V3TbwDBOc8FEbcax4HDgLma7",
    });

    expect(resolveYouTubeCommunityPostTarget("https://www.youtube.com/channel/UC123/community?lb=Ugkx30z9Hvx7V3TbwDBOc8FEbcax4HDgLma7")).toEqual({
      postId: "Ugkx30z9Hvx7V3TbwDBOc8FEbcax4HDgLma7",
      url: "https://www.youtube.com/post/Ugkx30z9Hvx7V3TbwDBOc8FEbcax4HDgLma7",
    });
  });

  test("accepts a bare YouTube community post id", () => {
    expect(resolveYouTubeCommunityPostTarget("Ugkx30z9Hvx7V3TbwDBOc8FEbcax4HDgLma7")).toEqual({
      postId: "Ugkx30z9Hvx7V3TbwDBOc8FEbcax4HDgLma7",
      url: "https://www.youtube.com/post/Ugkx30z9Hvx7V3TbwDBOc8FEbcax4HDgLma7",
    });
  });
});
