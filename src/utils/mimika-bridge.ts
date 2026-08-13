import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

/**
 * Bridge to a Mimika install on the same machine.
 *
 * Everything here is deliberately one-directional: mikacli adapts to Mimika, and
 * Mimika needs no change to accept it. Two seams make that possible.
 *
 * The browser. Mimika's managed Chrome is launched with
 * `--remote-debugging-port`, and the port is derived from the profile name
 * rather than random: `9333 + hash(profile) % 200`. Rather than reimplement that
 * hash and guess the profile, this probes the whole 200-port window for a live
 * CDP endpoint. It is loopback, so a parallel sweep costs milliseconds, and it
 * keeps working if Mimika changes how it picks within the range.
 *
 * The MCP registration. Mimika's `mcp_install` action resolves names against the
 * public MCP registry on purpose, so a model cannot talk it into connecting an
 * arbitrary endpoint. That guard is about the model, not the user: the store
 * itself keeps a flattened copy of the record and never re-validates it on load,
 * so a row written here by the person who owns the machine is honoured. Writing
 * it directly is the difference between "no Mimika changes" and "publish a
 * localhost server to a public registry".
 */

const CDP_PORT_BASE = 9333;
const CDP_PORT_SPAN = 200;
const PROBE_TIMEOUT_MS = 350;

export type MimikaCdpEndpoint = {
  port: number;
  browserUrl: string;
  webSocketDebuggerUrl: string;
  browser: string;
};

async function probePort(port: number): Promise<MimikaCdpEndpoint | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  try {
    const response = await fetch(`http://127.0.0.1:${port}/json/version`, {
      signal: controller.signal,
    });
    if (!response.ok) return null;
    const body = (await response.json()) as {
      Browser?: string;
      webSocketDebuggerUrl?: string;
    };
    if (!body.webSocketDebuggerUrl) return null;
    return {
      port,
      browserUrl: `http://127.0.0.1:${port}`,
      webSocketDebuggerUrl: body.webSocketDebuggerUrl,
      browser: body.Browser ?? "unknown",
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Find Mimika's managed browser, or null when it is not running.
 *
 * Null is a normal answer, not a failure: Mimika may be in extension mode, which
 * exposes no CDP endpoint at all, or simply not running. Callers fall back to
 * their own browser rather than erroring.
 */
export async function findMimikaCdpEndpoint(): Promise<MimikaCdpEndpoint | null> {
  const ports: number[] = [];
  for (let offset = 0; offset < CDP_PORT_SPAN; offset += 1) {
    ports.push(CDP_PORT_BASE + offset);
  }

  // Sweep in batches so a stalled port cannot hold up the whole scan, and stop
  // at the first hit — a machine will not have two Mimika browsers up.
  const BATCH = 40;
  for (let index = 0; index < ports.length; index += BATCH) {
    const batch = ports.slice(index, index + BATCH);
    const found = (await Promise.all(batch.map(probePort))).find((entry) => entry !== null);
    if (found) return found;
  }
  return null;
}

// ---------------------------------------------------------------------------
// MCP registration
// ---------------------------------------------------------------------------

export type MimikaMcpRow = {
  name: string;
  title: string;
  url: string;
  transport: string;
  version: string;
  header_name: string;
  header_value: string;
};

/**
 * Resolve the store exactly the way Mimika does.
 *
 * Mimika reads `MIMIKA_MCP_STORE` as a full path override, and otherwise
 * `$HOME/.mimika/mcp.json`. It does not consult `MIMIKA_STATE_DIR` for this
 * file, so honouring that here would write a row Mimika never reads — a failure
 * that looks exactly like the registration silently not working.
 */
export function mimikaMcpStorePath(): string {
  const override = process.env.MIMIKA_MCP_STORE?.trim();
  if (override) return override;
  const home = process.env.HOME ?? homedir();
  return join(home, ".mimika", "mcp.json");
}

type McpStoreFile = { servers?: MimikaMcpRow[] };

async function readStore(path: string): Promise<McpStoreFile> {
  try {
    const raw = await readFile(path, "utf8");
    const parsed = JSON.parse(raw) as McpStoreFile;
    if (!parsed || typeof parsed !== "object") return { servers: [] };
    return { servers: Array.isArray(parsed.servers) ? parsed.servers : [] };
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") return { servers: [] };
    // A malformed store is not ours to repair. Refusing here keeps a broken file
    // broken rather than silently replacing the user's other connected servers.
    throw new Error(
      `Mimika's ${path} could not be read as JSON. Fix or delete it before registering: ${String(error)}`,
    );
  }
}

async function writeStore(path: string, store: McpStoreFile): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  // 0600: the row can carry a bearer token, and Mimika writes its own store the
  // same way.
  await writeFile(path, `${JSON.stringify(store, null, 2)}\n`, { mode: 0o600 });
}

export const MIMIKA_SERVER_NAME = "local.mikacli/mikacli";

export function buildRow(options: { url: string; version: string; token?: string }): MimikaMcpRow {
  return {
    name: MIMIKA_SERVER_NAME,
    title: "mikacli",
    url: options.url,
    transport: "streamable-http",
    version: options.version,
    header_name: options.token ? "Authorization" : "",
    header_value: options.token ? `Bearer ${options.token}` : "",
  };
}

export type RegisterResult = {
  path: string;
  action: "added" | "updated";
  row: MimikaMcpRow;
};

export async function registerWithMimika(options: {
  url: string;
  version: string;
  token?: string;
}): Promise<RegisterResult> {
  const path = mimikaMcpStorePath();
  const store = await readStore(path);
  const servers = store.servers ?? [];
  const row = buildRow(options);

  const existing = servers.findIndex((entry) => entry.name === MIMIKA_SERVER_NAME);
  const action: "added" | "updated" = existing >= 0 ? "updated" : "added";
  if (existing >= 0) {
    servers[existing] = row;
  } else {
    servers.push(row);
  }

  await writeStore(path, { servers });
  return { path, action, row };
}

export async function unregisterFromMimika(): Promise<{ path: string; removed: boolean }> {
  const path = mimikaMcpStorePath();
  const store = await readStore(path);
  const servers = store.servers ?? [];
  const next = servers.filter((entry) => entry.name !== MIMIKA_SERVER_NAME);
  if (next.length === servers.length) return { path, removed: false };
  await writeStore(path, { servers: next });
  return { path, removed: true };
}

export async function isRegisteredWithMimika(): Promise<boolean> {
  const store = await readStore(mimikaMcpStorePath());
  return (store.servers ?? []).some((entry) => entry.name === MIMIKA_SERVER_NAME);
}
