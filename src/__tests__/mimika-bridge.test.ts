import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  MIMIKA_SERVER_NAME,
  buildRow,
  isRegisteredWithMimika,
  mimikaMcpStorePath,
  registerWithMimika,
  unregisterFromMimika,
} from "../utils/mimika-bridge.js";

let storeDir: string;
let previousOverride: string | undefined;

beforeEach(async () => {
  storeDir = await mkdtemp(join(tmpdir(), "mimika-bridge-"));
  previousOverride = process.env.MIMIKA_MCP_STORE;
  process.env.MIMIKA_MCP_STORE = join(storeDir, "mcp.json");
});

afterEach(() => {
  if (previousOverride === undefined) delete process.env.MIMIKA_MCP_STORE;
  else process.env.MIMIKA_MCP_STORE = previousOverride;
});

describe("store path resolution", () => {
  test("honours the same override Mimika reads", () => {
    process.env.MIMIKA_MCP_STORE = "/tmp/somewhere/mcp.json";
    expect(mimikaMcpStorePath()).toBe("/tmp/somewhere/mcp.json");
  });

  test("falls back to $HOME/.mimika/mcp.json, not a state dir", () => {
    // Mimika resolves this file from HOME and MIMIKA_MCP_STORE only. Reading
    // MIMIKA_STATE_DIR here would write a row Mimika never loads, which looks
    // exactly like registration silently failing.
    delete process.env.MIMIKA_MCP_STORE;
    process.env.MIMIKA_STATE_DIR = "/tmp/decoy";
    expect(mimikaMcpStorePath()).toBe(join(process.env.HOME ?? "", ".mimika", "mcp.json"));
    delete process.env.MIMIKA_STATE_DIR;
  });
});

describe("row shape", () => {
  test("matches the fields Mimika's store deserialises", () => {
    const row = buildRow({ url: "http://127.0.0.1:8787", version: "1.0.1" });
    expect(Object.keys(row).sort()).toEqual([
      "header_name",
      "header_value",
      "name",
      "title",
      "transport",
      "url",
      "version",
    ]);
    expect(row.transport).toBe("streamable-http");
  });

  test("carries a bearer token only when one was given", () => {
    expect(buildRow({ url: "u", version: "1" }).header_name).toBe("");
    const secured = buildRow({ url: "u", version: "1", token: "abc" });
    expect(secured.header_name).toBe("Authorization");
    expect(secured.header_value).toBe("Bearer abc");
  });
});

describe("register and unregister", () => {
  test("adds a row, then updates rather than duplicating it", async () => {
    const first = await registerWithMimika({ url: "http://127.0.0.1:8787", version: "1.0.1" });
    expect(first.action).toBe("added");

    const second = await registerWithMimika({ url: "http://127.0.0.1:9999", version: "1.0.1" });
    expect(second.action).toBe("updated");

    const parsed = JSON.parse(await readFile(process.env.MIMIKA_MCP_STORE!, "utf8")) as {
      servers: Array<{ name: string; url: string }>;
    };
    expect(parsed.servers.length).toBe(1);
    expect(parsed.servers[0]!.url).toBe("http://127.0.0.1:9999");
  });

  test("leaves other connected servers untouched", async () => {
    // The store is Mimika's, not ours. Rewriting it wholesale would silently
    // disconnect every other MCP server the user had.
    await writeFile(
      process.env.MIMIKA_MCP_STORE!,
      JSON.stringify({
        servers: [
          {
            name: "app.linear/linear",
            title: "Linear",
            url: "https://mcp.linear.app/mcp",
            transport: "streamable-http",
            version: "1.0.1",
            header_name: "",
            header_value: "",
          },
        ],
      }),
    );

    await registerWithMimika({ url: "http://127.0.0.1:8787", version: "1.0.1" });
    const afterAdd = JSON.parse(await readFile(process.env.MIMIKA_MCP_STORE!, "utf8")) as {
      servers: Array<{ name: string }>;
    };
    expect(afterAdd.servers.map((s) => s.name).sort()).toEqual([
      "app.linear/linear",
      MIMIKA_SERVER_NAME,
    ]);

    await unregisterFromMimika();
    const afterRemove = JSON.parse(await readFile(process.env.MIMIKA_MCP_STORE!, "utf8")) as {
      servers: Array<{ name: string }>;
    };
    expect(afterRemove.servers.map((s) => s.name)).toEqual(["app.linear/linear"]);
  });

  test("reports registration state, and treats a missing store as not registered", async () => {
    expect(await isRegisteredWithMimika()).toBe(false);
    await registerWithMimika({ url: "http://127.0.0.1:8787", version: "1.0.1" });
    expect(await isRegisteredWithMimika()).toBe(true);
  });

  test("unregistering something that was never there is not an error", async () => {
    const result = await unregisterFromMimika();
    expect(result.removed).toBe(false);
  });

  test("refuses to overwrite a store it cannot parse", async () => {
    // Replacing a malformed file would discard whatever the user had in it.
    await writeFile(process.env.MIMIKA_MCP_STORE!, "{ not json");
    await expect(
      registerWithMimika({ url: "http://127.0.0.1:8787", version: "1.0.1" }),
    ).rejects.toThrow(/could not be read as JSON/);
  });
});
