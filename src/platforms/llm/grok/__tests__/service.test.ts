import { describe, expect, test } from "bun:test";

import { inspectGrokHomeHtml, mapGrokError, parseGrokConversationStream } from "../service.js";
import { MikaCliError } from "../../../../errors.js";

describe("grok service helpers", () => {
  test("detects an authenticated Grok homepage from subscription state", () => {
    const inspection = inspectGrokHomeHtml(`
      <script>
        window.__STATE__ = {
          "bestSubscription":"SUBSCRIPTION_TIER_GROK_PRO",
          "activeSubscriptions":[{"xaiUserId":"user-123"}]
        };
      </script>
    `);

    expect(inspection).toEqual({
      isAuthenticated: true,
      subscriptionTier: "SUBSCRIPTION_TIER_GROK_PRO",
      userId: "user-123",
    });
  });

  test("detects an authenticated Grok homepage from escaped dehydrated JSON", () => {
    const inspection = inspectGrokHomeHtml(`
      <script type="application/json">
        {"children":"{\\\"bestSubscription\\\":\\\"SUBSCRIPTION_TIER_GROK_PRO\\\",\\\"activeSubscriptions\\\":[{\\\"xaiUserId\\\":\\\"user-456\\\"}]}"}
      </script>
    `);

    expect(inspection).toEqual({
      isAuthenticated: true,
      subscriptionTier: "SUBSCRIPTION_TIER_GROK_PRO",
      userId: "user-456",
    });
  });

  test("parses Grok create/respond chunks and keeps the longest model response", () => {
    const parsed = parseGrokConversationStream(`
{"result":{"conversation":{"conversationId":"conv-123"},"response":{"modelResponse":{"responseId":"resp-1","sender":"grok-3","message":"Hel"},"token":"Hel"}}}
{"result":{"response":{"modelResponse":{"responseId":"resp-1","sender":"grok-3","message":"Hello there"},"finalMetadata":{"followUpSuggestions":{"suggestions":[{"suggestion":"Ask about pricing"}]}}}}}
    `);

    expect(parsed).toEqual({
      outputText: "Hello there",
      conversationId: "conv-123",
      responseId: "resp-1",
      model: "grok-3",
      followUpSuggestions: ["Ask about pricing"],
      imageAssets: [],
      videoUpdates: [],
    });
  });

  test("parses Grok generated image cards and keeps the final asset", () => {
    const partialCard = JSON.stringify({
      id: "card-1",
      type: "render_generated_image",
      cardType: "generated_image_card",
      image_chunk: {
        imageUuid: "img-123",
        imageUrl: "users/demo/generated/img-123-part-0/image.jpg",
        progress: 50,
      },
    });
    const finalCard = JSON.stringify({
      id: "card-1",
      type: "render_generated_image",
      cardType: "generated_image_card",
      image_chunk: {
        imageUuid: "img-123",
        imageUrl: "users/demo/generated/img-123/image.jpg",
        progress: 100,
      },
    });
    const parsed = parseGrokConversationStream(
      `${JSON.stringify({
        result: {
          conversation: { conversationId: "conv-image" },
          response: {
            cardAttachment: {
              jsonData: partialCard,
            },
          },
        },
      })}\n${JSON.stringify({
        result: {
          response: {
            cardAttachment: {
              jsonData: finalCard,
            },
          },
        },
      })}`,
    );

    expect(parsed.imageAssets).toEqual([
      {
        imageUuid: "img-123",
        assetPath: "users/demo/generated/img-123/image.jpg",
        progress: 100,
        cardId: "card-1",
      },
    ]);
  });

  test("parses Grok streaming video generation chunks", () => {
    const parsed = parseGrokConversationStream(`
{"result":{"conversation":{"conversationId":"conv-video"},"response":{"streamingVideoGenerationResponse":{"videoId":"video-123","progress":20,"modelName":"imagine-video-gen","resolutionName":"360p","mode":"normal","parentPostId":"img-123"}}}}
{"result":{"response":{"streamingVideoGenerationResponse":{"videoId":"video-123","videoUrl":"users/demo/generated/video-123/video.mp4","progress":100,"modelName":"imagine-video-gen","resolutionName":"360p","mode":"normal","parentPostId":"img-123","videoPostId":"post-123"}}}}
    `);

    expect(parsed.videoUpdates).toEqual([
      {
        videoId: "video-123",
        progress: 20,
        modelName: "imagine-video-gen",
        resolutionName: "360p",
        mode: "normal",
        parentPostId: "img-123",
        videoPostId: undefined,
        videoUrl: undefined,
      },
      {
        videoId: "video-123",
        videoUrl: "users/demo/generated/video-123/video.mp4",
        progress: 100,
        modelName: "imagine-video-gen",
        resolutionName: "360p",
        mode: "normal",
        parentPostId: "img-123",
        videoPostId: "post-123",
      },
    ]);
  });

  test("maps Grok anti-bot errors to a provider-specific code", () => {
    const mapped = mapGrokError(
      new MikaCliError(
        "GROK_ANTI_BOT_BLOCKED",
        "Grok rejected the browserless request with its current anti-bot rules.",
      ),
      "fallback",
    );

    expect(mapped.code).toBe("GROK_ANTI_BOT_BLOCKED");
  });
});
