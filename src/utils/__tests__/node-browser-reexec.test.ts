import { describe, expect, it } from "bun:test";

import { MikaCliError } from "../../errors.js";
import {
  BROWSER_NODE_REEXEC_ERROR_CODE,
  buildNodeBrowserReexecArgs,
  isBrowserNodeReexecRequired,
  resolveNodeCliEntrypoint,
} from "../node-browser-reexec.js";

describe("node browser re-exec helpers", () => {
  it("detects the dedicated shared-browser re-exec error", () => {
    const error = new MikaCliError(
      BROWSER_NODE_REEXEC_ERROR_CODE,
      "Shared-browser actions need the Node runtime.",
    );

    expect(isBrowserNodeReexecRequired(error)).toBe(true);
    expect(
      isBrowserNodeReexecRequired(new MikaCliError("BROWSER_LOGIN_FAILED", "No browser.")),
    ).toBe(false);
    expect(isBrowserNodeReexecRequired(new Error("plain error"))).toBe(false);
  });

  it("resolves the bundled Node CLI entrypoint next to the project root", () => {
    const entrypoint = resolveNodeCliEntrypoint("file:///Users/example/dev/mikacli/src/index.ts");

    expect(entrypoint).toBe("/Users/example/dev/mikacli/dist/index.js");
  });

  it("adds a valid localStorage file when re-execing browser actions under Node", () => {
    const args = buildNodeBrowserReexecArgs(
      "/Users/example/dev/mikacli/dist/index.js",
      ["/Users/example/.bun/bin/bun", "src/index.ts", "login", "--browser"],
      "/Users/example/.mikacli/cache/node-localstorage.json",
    );

    expect(args).toEqual([
      "--localstorage-file=/Users/example/.mikacli/cache/node-localstorage.json",
      "/Users/example/dev/mikacli/dist/index.js",
      "login",
      "--browser",
    ]);
  });
});
