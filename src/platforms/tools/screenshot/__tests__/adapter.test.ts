import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { parseMicrolinkScreenshotResponse, screenshotAdapter } from "../adapter.js";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("screenshot adapter", () => {
  test("parses a microlink screenshot response", () => {
    const parsed = parseMicrolinkScreenshotResponse({
      status: "success",
      data: {
        url: "https://example.com/",
        screenshot: {
          url: "https://cdn.example.com/example.png",
          type: "png",
          width: 1280,
          height: 720,
          size: 12345,
        },
      },
    });

    expect(parsed).toEqual({
      screenshotUrl: "https://cdn.example.com/example.png",
      sourceUrl: "https://example.com/",
      type: "png",
      width: 1280,
      height: 720,
      size: 12345,
    });
  });

  test("downloads and saves a screenshot", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "mikacli-screenshot-test-"));
    const outputPath = join(tempDir, "example.png");

    let requestCount = 0;
    globalThis.fetch = (async (input: string | URL | Request) => {
      requestCount += 1;
      const url = String(input);

      if (requestCount === 1) {
        expect(url).toContain("api.microlink.io");
        return new Response(
          JSON.stringify({
            status: "success",
            data: {
              url: "https://example.com/",
              screenshot: {
                url: "https://cdn.example.com/example.png",
                type: "png",
                width: 1280,
                height: 720,
              },
            },
          }),
          {
            status: 200,
            headers: {
              "content-type": "application/json",
            },
          },
        );
      }

      expect(url).toBe("https://cdn.example.com/example.png");
      return new Response(Uint8Array.from([137, 80, 78, 71]), {
        status: 200,
        headers: {
          "content-type": "image/png",
        },
      });
    }) as unknown as typeof fetch;

    const result = await screenshotAdapter.screenshot({
      target: "example.com",
      output: outputPath,
    });

    expect(result.ok).toBe(true);
    expect(String(result.platform)).toBe("screenshot");
    expect(result.data?.outputPath).toBe(outputPath);
    expect(existsSync(outputPath)).toBe(true);
    expect(readFileSync(outputPath)).toEqual(Buffer.from([137, 80, 78, 71]));

    rmSync(tempDir, { recursive: true, force: true });
  });
});
