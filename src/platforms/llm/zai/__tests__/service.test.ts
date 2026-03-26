import { describe, expect, test } from "bun:test";

import { buildZaiSignature, buildZaiSortedPayload, parseZaiCompletionStream } from "../service.js";

describe("zai service helpers", () => {
  test("builds the signed payload exactly like the web app", () => {
    const sortedPayload = buildZaiSortedPayload({
      requestId: "123e4567-e89b-12d3-a456-426614174000",
      timestamp: "1774500300000",
      userId: "user-42",
    });

    expect(sortedPayload).toBe("requestId,123e4567-e89b-12d3-a456-426614174000,timestamp,1774500300000,user_id,user-42");
    expect(buildZaiSignature(sortedPayload, "Reply with exactly: hi-clean", "1774500300000")).toBe(
      "1fe0f2184a7b73b49fa475d9bcad3740109976f7e23959ec1e1d5635eda17591",
    );
  });

  test("parses streamed answer chunks and edit patches", () => {
    const stream = [
      'data: {"type":"chat:completion","data":{"delta_content":"hi","phase":"answer"}}',
      "",
      'data: {"type":"chat:completion","data":{"phase":"other","usage":{"prompt_tokens":11,"completion_tokens":3,"total_tokens":14}}}',
      "",
      'data: {"type":"chat:completion","data":{"edit_index":2,"edit_content":"-clean","phase":"other"}}',
      "",
      'data: {"type":"chat:completion","data":{"phase":"done","done":true}}',
      "",
    ].join("\n");

    const parsed = parseZaiCompletionStream(stream);

    expect(parsed.outputText).toBe("hi-clean");
    expect(parsed.usage?.total_tokens).toBe(14);
  });
});
