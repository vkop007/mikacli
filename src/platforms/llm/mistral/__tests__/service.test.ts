import { describe, expect, test } from "bun:test";

import { extractMistralMessageText, parseMistralChatStream } from "../service.js";

describe("mistral service helpers", () => {
  test("parses assistant text from the streamed /api/chat patch format", () => {
    const parsed = parseMistralChatStream(`
16:{"json":{"disclaimers":[]}}
15:{"json":{"type":"message","messageId":"assistant-1","messageVersion":0,"patches":[{"op":"replace","path":"/","value":{"role":"assistant","id":"assistant-1"}}]}}
15:{"json":{"type":"message","messageId":"assistant-1","messageVersion":0,"patches":[{"op":"replace","path":"/contentChunks","value":[{"type":"text","text":"Hello","_context":null}]}]}}
15:{"json":{"type":"message","messageId":"assistant-1","messageVersion":0,"patches":[{"op":"append","path":"/contentChunks/0/text","value":" world"}]}}
    `);

    expect(parsed).toEqual({
      assistantMessageId: "assistant-1",
      outputText: "Hello world",
    });
  });

  test("extracts text from persisted content chunks when content is empty", () => {
    const text = extractMistralMessageText({
      content: null,
      contentChunks: [
        { type: "text", text: "Hello" },
        { type: "text", text: " again" },
      ],
    });

    expect(text).toBe("Hello again");
  });
});
