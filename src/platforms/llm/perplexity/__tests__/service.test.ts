import { describe, expect, test } from "bun:test";

import { parsePerplexityCompletionPayloads } from "../service.js";

describe("perplexity service helpers", () => {
  test("parses the final polling payload into plain output text", () => {
    const parsed = parsePerplexityCompletionPayloads([
      {
        backend_uuid: "backend-1",
        uuid: "query-1",
        thread_url_slug: "hello-thread",
        display_model: "turbo",
        mode: "CONCISE",
        search_focus: "internet",
        status: "PENDING",
        final: false,
        answer_modes: [{ answer_mode_type: "SEARCH" }, { answer_mode_type: "IMAGE" }],
        blocks: [
          {
            intended_usage: "ask_text_0_markdown",
            markdown_block: {
              progress: "IN_PROGRESS",
              chunks: ["Hello! How"],
              chunk_starting_offset: 0,
            },
          },
        ],
      },
      {
        backend_uuid: "backend-1",
        uuid: "query-1",
        thread_url_slug: "hello-thread",
        display_model: "turbo",
        mode: "CONCISE",
        search_focus: "internet",
        status: "PENDING",
        final: false,
        blocks: [
          {
            intended_usage: "ask_text_0_markdown",
            markdown_block: {
              progress: "IN_PROGRESS",
              chunks: [" can I help you today?"],
              chunk_starting_offset: 10,
            },
          },
        ],
      },
      {
        backend_uuid: "backend-1",
        uuid: "query-1",
        thread_url_slug: "hello-thread",
        display_model: "turbo",
        mode: "CONCISE",
        search_focus: "internet",
        status: "COMPLETED",
        final: true,
        text: JSON.stringify([
          {
            step_type: "INITIAL_QUERY",
            content: {
              query: "Hello",
            },
          },
          {
            step_type: "FINAL",
            content: {
              answer: JSON.stringify({
                answer: "Hello! How can I help you today?",
                web_results: [{ url: "https://example.com" }],
                structured_answer: [
                  {
                    type: "markdown",
                    text: "Hello! How can I help you today?",
                  },
                ],
              }),
            },
          },
        ]),
      },
    ]);

    expect(parsed.outputText).toBe("Hello! How can I help you today?");
    expect(parsed.model).toBe("turbo");
    expect(parsed.mode).toBe("CONCISE");
    expect(parsed.searchFocus).toBe("internet");
    expect(parsed.queryId).toBe("query-1");
    expect(parsed.threadUrlSlug).toBe("hello-thread");
    expect(parsed.backendUuid).toBe("backend-1");
    expect(parsed.answerModes).toEqual(["SEARCH", "IMAGE"]);
    expect(parsed.webResults).toEqual([{ url: "https://example.com" }]);
  });
});
