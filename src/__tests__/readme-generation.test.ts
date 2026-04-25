import { describe, expect, test } from "bun:test";

import { renderReadme } from "../../scripts/generate-readme.js";

describe("README generation", () => {
  test("generated README sections stay in sync with the template markers", async () => {
    const readme = (await Bun.file(new URL("../../README.md", import.meta.url)).text()).replace(/\r\n/g, "\n");
    expect(await renderReadme()).toBe(readme);
  });
});
