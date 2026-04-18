import { describe, expect, test } from "bun:test";

import { buildPlatformCommand } from "../../../../core/runtime/build-platform-command.js";
import { tempMailPlatformDefinition } from "../manifest.js";
import {
  buildTempMailAddress,
  extractLinks,
  extractVerificationCodes,
  normalizeTempMailLocalPart,
  pickTempMailDomain,
} from "../adapter.js";

describe("temp mail provider helpers", () => {
  test("normalizes mailbox local parts into safe values", () => {
    expect(normalizeTempMailLocalPart(" My Signup Inbox ")).toBe("my-signup-inbox");
    expect(normalizeTempMailLocalPart("A.B_C")).toBe("a.b_c");
  });

  test("builds temp mail addresses from a local part and domain", () => {
    expect(buildTempMailAddress("autocli-123", "example.com")).toBe("autocli-123@example.com");
  });

  test("selects an explicit public active domain when requested", () => {
    expect(
      pickTempMailDomain(
        [
          {
            id: "1",
            domain: "one.example",
            isActive: true,
            isPrivate: false,
          },
          {
            id: "2",
            domain: "two.example",
            isActive: true,
            isPrivate: false,
          },
        ],
        "two.example",
      ).domain,
    ).toBe("two.example");
  });

  test("extracts unique numeric verification codes and links", () => {
    expect(extractVerificationCodes("Your code is 123456. Backup code 123456. Short code 7890.")).toEqual(["123456", "7890"]);
    expect(extractLinks("Open https://example.com/verify and https://example.com/reset now.")).toEqual([
      "https://example.com/verify",
      "https://example.com/reset",
    ]);
  });
});

describe("temp mail command surface", () => {
  test("exposes the expected temp mail commands", () => {
    const command = buildPlatformCommand(tempMailPlatformDefinition);

    expect(command.name()).toBe("tempmail");
    expect(command.commands.map((entry) => entry.name())).toEqual([
      "domains",
      "create",
      "login",
      "status",
      "me",
      "inbox",
      "message",
      "wait",
      "mark-read",
      "delete-message",
      "delete-inbox",
      "capabilities",
    ]);
  });

  test("uses category-based examples in the manifest", () => {
    const examples = tempMailPlatformDefinition.examples ?? [];
    expect(examples.every((example) => example.startsWith("autocli tools tempmail"))).toBe(true);
  });
});
