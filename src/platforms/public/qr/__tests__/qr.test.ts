import { describe, expect, test } from "bun:test";

import { buildPlatformCommand } from "../../../../core/runtime/build-platform-command.js";
import { qrPlatformDefinition } from "../manifest.js";
import { buildQrImageUrl, buildQrShareUrl, normalizeQrText, parsePositiveInteger, scaleQrSize } from "../helpers.js";

describe("public qr provider", () => {
  test("builds qr urls", () => {
    expect(buildQrShareUrl("https://example.com")).toBe("https://qrenco.de/https%3A%2F%2Fexample.com");
    expect(buildQrImageUrl({ text: "hello world", size: 6, margin: 2 })).toBe(
      "https://quickchart.io/qr?text=hello%20world&size=300&margin=2",
    );
  });

  test("parses positive integers", () => {
    expect(parsePositiveInteger("6", "size")).toBe(6);
    expect(scaleQrSize(6)).toBe(300);
  });

  test("normalizes qr text", () => {
    expect(normalizeQrText("  hello world  ")).toBe("hello world");
  });

  test("builds a command with the qr capability", () => {
    const command = buildPlatformCommand(qrPlatformDefinition);
    expect(command.name()).toBe("qr");
    expect(command.commands).toHaveLength(0);
  });
});
