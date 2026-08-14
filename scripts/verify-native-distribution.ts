import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import packageJson from "../package.json" with { type: "json" };
import {
  MCP_PROTOCOL_VERSION,
  MIKA_MANAGEMENT_PROTOCOL_VERSION,
  PLATFORM_CATALOG_SCHEMA_VERSION,
} from "../src/integration-metadata.ts";
import {
  NATIVE_DISTRIBUTION_SCHEMA_VERSION,
  NATIVE_MANIFEST_FILENAME,
  NATIVE_TARGETS,
} from "../src/native-distribution.ts";

import type { NativeArtifactDigest, NativeDistributionManifest } from "../src/native-distribution.ts";

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));

await main();

async function main(): Promise<void> {
  const options = parseOptions(process.argv.slice(2));
  const manifestPath = resolve(repoRoot, options.manifestPath);
  const distributionDirectory = dirname(manifestPath);
  const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as NativeDistributionManifest;

  assert(manifest.schemaVersion === NATIVE_DISTRIBUTION_SCHEMA_VERSION, "native manifest schema version");
  assert(manifest.package.name === packageJson.name, "package name");
  assert(manifest.package.version === packageJson.version, "package version");
  assert(manifest.catalog.schemaVersion === PLATFORM_CATALOG_SCHEMA_VERSION, "catalog schema version");
  assert(manifest.catalog.revision === packageJson.version, "catalog revision");
  assert(manifest.protocols.mcp === MCP_PROTOCOL_VERSION, "MCP protocol version");
  assert(manifest.protocols.management === MIKA_MANAGEMENT_PROTOCOL_VERSION, "management protocol version");
  assert(manifest.distribution.requiresNode === false, "standalone runtime flag");

  if (!options.allowPartial) {
    const actualTargets = [...manifest.artifacts.map((artifact) => artifact.target)].sort();
    const expectedTargets = [...NATIVE_TARGETS.map((target) => target.id)].sort();
    assert(JSON.stringify(actualTargets) === JSON.stringify(expectedTargets), "complete native target matrix");
  }

  for (const artifact of manifest.artifacts) {
    await verifyArtifact(join(distributionDirectory, "bin", artifact.executable.filename), artifact.executable);
    await verifyArtifact(join(distributionDirectory, "packages", artifact.npm.filename), artifact.npm);
  }

  if (options.smoke) {
    const targetId = `${process.platform}-${process.arch}`;
    const artifact = manifest.artifacts.find((candidate) => candidate.target === targetId);
    if (!artifact) throw new Error(`Manifest has no artifact for current target ${targetId}.`);
    const binaryPath = join(distributionDirectory, "bin", artifact.executable.filename);
    const child = Bun.spawn([binaryPath, "--version"], { stdout: "pipe", stderr: "pipe" });
    const [stdout, stderr, code] = await Promise.all([
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
      child.exited,
    ]);
    assert(code === 0, `native smoke test exit code (${stderr.trim()})`);
    assert(stdout.trim() === packageJson.version, "native smoke test version");
  }

  process.stderr.write(`verified ${manifest.artifacts.length} native artifact set(s) from ${manifestPath}\n`);
}

async function verifyArtifact(path: string, expected: NativeArtifactDigest): Promise<void> {
  const [fileStat, hashes] = await Promise.all([stat(path), hashFile(path)]);
  assert(fileStat.size === expected.size, `${expected.filename} size`);
  assert(hashes.hex === expected.sha256, `${expected.filename} sha256`);
  assert(`sha256-${hashes.base64}` === expected.integrity, `${expected.filename} integrity`);
  assert(expected.url.startsWith("https://"), `${expected.filename} URL`);
}

function hashFile(path: string): Promise<{ hex: string; base64: string }> {
  return new Promise((resolveHash, reject) => {
    const hash = createHash("sha256");
    const stream = createReadStream(path);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", reject);
    stream.on("end", () => {
      const digest = hash.digest();
      resolveHash({ hex: digest.toString("hex"), base64: digest.toString("base64") });
    });
  });
}

function parseOptions(argv: readonly string[]): {
  manifestPath: string;
  allowPartial: boolean;
  smoke: boolean;
} {
  let manifestPath = join("native-dist", NATIVE_MANIFEST_FILENAME);
  let allowPartial = false;
  let smoke = false;
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--manifest") manifestPath = requireValue(argv, ++index, token);
    else if (token === "--allow-partial") allowPartial = true;
    else if (token === "--smoke") smoke = true;
    else throw new Error(`Unknown option: ${token}`);
  }
  return { manifestPath, allowPartial, smoke };
}

function assert(condition: boolean, label: string): asserts condition {
  if (!condition) throw new Error(`Native distribution verification failed: ${label}.`);
}

function requireValue(argv: readonly string[], index: number, option: string): string {
  const value = argv[index];
  if (!value) throw new Error(`${option} requires a value.`);
  return value;
}
