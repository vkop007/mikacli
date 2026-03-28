import { describe, expect, it } from "bun:test";

import { extractDataSourceTitle, extractPageTitle, findTitlePropertyName, normalizeNotionId, plainTextFromRichText } from "../platforms/developer/notion/helpers.js";

describe("notion helpers", () => {
  it("normalizes notion ids from compact uuids", () => {
    expect(normalizeNotionId("0123456789abcdef0123456789abcdef")).toBe("01234567-89ab-cdef-0123-456789abcdef");
  });

  it("extracts notion ids from page urls", () => {
    expect(normalizeNotionId("https://www.notion.so/workspace/My-Page-0123456789abcdef0123456789abcdef")).toBe(
      "01234567-89ab-cdef-0123-456789abcdef",
    );
  });

  it("finds the title property name", () => {
    expect(
      findTitlePropertyName({
        Name: {
          id: "title",
          type: "title",
        },
        Status: {
          id: "abc",
          type: "status",
        },
      }),
    ).toBe("Name");
  });

  it("extracts page and data source titles", () => {
    expect(
      extractPageTitle({
        properties: {
          Name: {
            type: "title",
            title: [{ plain_text: "Launch Checklist" }],
          },
        },
      }),
    ).toBe("Launch Checklist");

    expect(
      extractDataSourceTitle({
        title: [{ plain_text: "Project Tasks" }],
      }),
    ).toBe("Project Tasks");
  });

  it("joins rich text into plain text", () => {
    expect(plainTextFromRichText([{ plain_text: "Hello" }, { plain_text: " world" }])).toBe("Hello world");
  });
});
