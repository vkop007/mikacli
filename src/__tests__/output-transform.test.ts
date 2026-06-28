import { describe, expect, test } from "bun:test";
import { transformOutput, validateSelectFields } from "../core/output/output-transform.js";

describe("output transform utility", () => {
  test("selects fields correctly", () => {
    const data = {
      entity: {
        id: "123",
        name: "test",
        author: {
          id: "456",
          name: "John",
        },
      },
    };

    const result = transformOutput(data, {
      select: ["id", "author.name"],
    }) as any;

    expect(result.entity).toEqual({
      id: "123",
      author: {
        name: "John",
      },
    });
  });

  test("handles null intermediate fields during selection without crashing", () => {
    const data = {
      entity: {
        id: "123",
        author: null,
      },
    };

    const result = transformOutput(data, {
      select: ["id", "author.name"],
    }) as any;

    expect(result.entity).toEqual({
      id: "123",
    });
  });

  test("validates select fields correctly", () => {
    const data = {
      entity: {
        id: "123",
        name: "test",
      },
    };

    const validation = validateSelectFields(data, ["id", "invalid_field"]);
    expect(validation.valid).toBe(false);
    expect(validation.missingFields).toEqual(["invalid_field"]);
  });

  test("filters data with escaped quotes correctly", () => {
    const data = {
      items: [
        { name: "John's" },
        { name: "other" }
      ]
    };
    const result = transformOutput(data, {
      filter: "name = 'John\\'s'"
    }) as any;
    expect(result.items.length).toBe(1);
    expect(result.items[0].name).toBe("John's");
  });
});
