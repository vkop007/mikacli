import { describe, expect, it } from "bun:test";

import {
  extractDataSourceTitle,
  extractNotionViewId,
  extractPageTitle,
  findCollectionTitlePropertyId,
  findTitlePropertyName,
  normalizeNotionId,
  plainTextFromRichText,
  plainTextFromSemanticString,
  semanticStringFromPlainText,
} from "../platforms/developer/notion/helpers.js";

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

  it("handles semantic strings and collection title properties", () => {
    expect(plainTextFromSemanticString([["Hello"], [" world"]])).toBe("Hello world");
    expect(semanticStringFromPlainText("Launch")).toEqual([["Launch"]]);
    expect(
      findCollectionTitlePropertyId({
        abc1: { name: "Status", type: "select" },
        title: { name: "Name", type: "title" },
      }),
    ).toBe("title");
  });

  it("extracts page title from collection-style properties and view ids from urls", () => {
    expect(
      extractPageTitle(
        {
          properties: {
            title: [["Database row"]],
          },
        },
        { titlePropertyId: "title" },
      ),
    ).toBe("Database row");

    expect(extractNotionViewId("https://www.notion.so/workspace/My-DB-0123456789abcdef0123456789abcdef?v=fedcba9876543210fedcba9876543210")).toBe(
      "fedcba98-7654-3210-fedc-ba9876543210",
    );

    expect(
      extractDataSourceTitle({
        name: [["Projects"]],
      }),
    ).toBe("Projects");
  });
});
