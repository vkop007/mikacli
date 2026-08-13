import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { chmod, copyFile, mkdir, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import packageJson from "../package.json" with { type: "json" };
import {
  MCP_PROTOCOL_VERSION,
  MIKA_MANAGEMENT_PROTOCOL_VERSION,
  PLATFORM_CATALOG_SCHEMA_VERSION,
  PLATFORM_STATE_SCHEMA_VERSION,
} from "../src/integration-metadata.ts";
import {
  NATIVE_DISTRIBUTION_SCHEMA_VERSION,
  NATIVE_MANIFEST_FILENAME,
  NATIVE_TARGETS,
  nativeManifestUrl,
  nativeReleaseBaseUrl,
  npmTarballUrl,
} from "../src/native-distribution.ts";
import { GENERATED_PLATFORM_NAMES } from "../src/platforms/generated-metadata.ts";

import type {
  NativeArtifactDigest,
  NativeDistributionManifest,
  NativeManifestArtifact,
  NativeTarget,
  NativeTargetId,
} from "../src/native-distribution.ts";

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));

await main();

async function main(): Promise<void> {
  const options = parseOptions(process.argv.slice(2));
  const outputDirectory = resolve(repoRoot, options.outputDirectory);
  const binaryDirectory = join(outputDirectory, "bin");
  const packageDirectory = join(outputDirectory, "packages");
  const stagingDirectory = join(outputDirectory, "staging");
  await mkdir(binaryDirectory, { recursive: true });
  await mkdir(packageDirectory, { recursive: true });
  await mkdir(stagingDirectory, { recursive: true });

  const artifacts: NativeManifestArtifact[] = [];
  for (const target of options.targets) {
    process.stderr.write(`building ${target.id} (${target.bunTarget})\n`);
    const binaryPath = join(binaryDirectory, target.assetName);
    await run(process.execPath, [
      "build",
      "--compile",
      `--target=${target.bunTarget}`,
      "--define=__MIKACLI_STANDALONE__=true",
      "--external=electron",
      "--external=chromium-bidi/*",
      "--no-compile-autoload-dotenv",
      "--no-compile-autoload-bunfig",
      "--outfile",
      binaryPath,
      "./src/index.ts",
    ], repoRoot);
    if (target.os !== "win32") await chmod(binaryPath, 0o755);

    const executable = await describeArtifact(
      binaryPath,
      `${options.releaseBaseUrl}/${target.assetName}`,
    );
    const npmArtifact = await createPlatformPackage({
      target,
      executable,
      binaryPath,
      stagingDirectory,
      packageDirectory,
    });
    artifacts.push({
      target: target.id,
      os: target.os,
      arch: target.arch,
      executable,
      npm: npmArtifact,
    });
  }

  const manifest: NativeDistributionManifest = {
    schemaVersion: NATIVE_DISTRIBUTION_SCHEMA_VERSION,
    package: { name: packageJson.name, version: packageJson.version },
    generatedAt: new Date().toISOString(),
    catalog: {
      schemaVersion: PLATFORM_CATALOG_SCHEMA_VERSION,
      revision: packageJson.version,
      providerCount: GENERATED_PLATFORM_NAMES.length,
      stateSchemaVersion: PLATFORM_STATE_SCHEMA_VERSION,
    },
    protocols: {
      mcp: MCP_PROTOCOL_VERSION,
      management: MIKA_MANAGEMENT_PROTOCOL_VERSION,
    },
    distribution: {
      format: "standalone-executable",
      requiresNode: false,
      manifestUrl: options.manifestUrl,
    },
    artifacts,
  };
  const manifestPath = join(outputDirectory, NATIVE_MANIFEST_FILENAME);
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  process.stderr.write(`wrote ${manifestPath}\n`);
}

async function createPlatformPackage(input: {
  target: NativeTarget;
  executable: NativeArtifactDigest;
  binaryPath: string;
  stagingDirectory: string;
  packageDirectory: string;
}): Promise<NativeArtifactDigest & { package: string }> {
  const packageRoot = join(input.stagingDirectory, input.target.id);
  await rm(packageRoot, { recursive: true, force: true });
  const packageBinDirectory = join(packageRoot, "bin");
  await mkdir(packageBinDirectory, { recursive: true });
  const packagedExecutableName = input.target.os === "win32" ? "mikacli.exe" : "mikacli";
  const packagedExecutablePath = join(packageBinDirectory, packagedExecutableName);
  await copyFile(input.binaryPath, packagedExecutablePath);
  if (input.target.os !== "win32") await chmod(packagedExecutablePath, 0o755);

  const platformPackage = {
    name: input.target.npmPackage,
    version: packageJson.version,
    description: `Standalone MikaCLI executable for ${input.target.id}`,
    license: packageJson.license,
    repository: packageJson.repository,
    os: [input.target.os],
    cpu: [input.target.arch],
    preferGlobal: true,
    bin: { mikacli: `bin/${packagedExecutableName}` },
    files: [`bin/${packagedExecutableName}`],
    publishConfig: { access: "public" },
    mikacliNative: {
      schemaVersion: NATIVE_DISTRIBUTION_SCHEMA_VERSION,
      target: input.target.id,
      requiresNode: false,
      executableSha256: input.executable.sha256,
      executableIntegrity: input.executable.integrity,
      manifestUrl: nativeManifestUrl(packageJson.version),
      protocols: {
        mcp: MCP_PROTOCOL_VERSION,
        management: MIKA_MANAGEMENT_PROTOCOL_VERSION,
      },
      catalog: {
        schemaVersion: PLATFORM_CATALOG_SCHEMA_VERSION,
        revision: packageJson.version,
      },
    },
  };
  await writeFile(join(packageRoot, "package.json"), `${JSON.stringify(platformPackage, null, 2)}\n`, "utf8");
  const packedOutput = await run(
    "npm",
    ["pack", "--json", "--ignore-scripts", "--pack-destination", input.packageDirectory],
    packageRoot,
  );
  const packed = JSON.parse(packedOutput) as Array<{ filename?: string }>;
  const filename = packed[0]?.filename;
  if (!filename) throw new Error(`npm pack did not report an archive for ${input.target.id}.`);
  const archivePath = join(input.packageDirectory, filename);
  return {
    package: input.target.npmPackage,
    ...await describeArtifact(archivePath, npmTarballUrl(input.target, packageJson.version)),
  };
}

async function describeArtifact(path: string, url: string): Promise<NativeArtifactDigest> {
  const [fileStat, hashes] = await Promise.all([stat(path), hashFile(path)]);
  return {
    filename: path.slice(path.lastIndexOf("/") + 1),
    url,
    size: fileStat.size,
    sha256: hashes.hex,
    integrity: `sha256-${hashes.base64}`,
  };
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

function run(command: string, args: readonly string[], cwd: string): Promise<string> {
  return new Promise((resolveRun, reject) => {
    const child = Bun.spawn([command, ...args], {
      cwd,
      stdin: "ignore",
      stdout: "pipe",
      stderr: "pipe",
    });
    Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited])
      .then(([stdout, stderr, exitCode]) => {
        if (stderr) process.stderr.write(stderr);
        if (exitCode !== 0) {
          reject(new Error(`${command} exited with ${exitCode}.`));
          return;
        }
        resolveRun(stdout);
      }, reject);
  });
}

function parseOptions(argv: readonly string[]): {
  outputDirectory: string;
  releaseBaseUrl: string;
  manifestUrl: string;
  targets: readonly NativeTarget[];
} {
  let outputDirectory = "native-dist";
  let releaseBaseUrl = nativeReleaseBaseUrl(packageJson.version);
  const requestedTargets: string[] = [];
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--output-dir") outputDirectory = requireValue(argv, ++index, token);
    else if (token === "--release-base-url") releaseBaseUrl = requireValue(argv, ++index, token).replace(/\/$/, "");
    else if (token === "--target") requestedTargets.push(requireValue(argv, ++index, token));
    else throw new Error(`Unknown option: ${token}`);
  }

  const normalizedTargets = requestedTargets.flatMap((target) => target === "current" ? [currentTargetId()] : [target]);
  const targetIds = normalizedTargets.length > 0 ? normalizedTargets : NATIVE_TARGETS.map((target) => target.id);
  const targets = targetIds.map((id) => {
    const target = NATIVE_TARGETS.find((candidate) => candidate.id === id);
    if (!target) throw new Error(`Unknown native target "${id}".`);
    return target;
  });
  return {
    outputDirectory,
    releaseBaseUrl,
    manifestUrl: `${releaseBaseUrl}/${NATIVE_MANIFEST_FILENAME}`,
    targets,
  };
}

function currentTargetId(): NativeTargetId {
  const id = `${process.platform}-${process.arch}`;
  if (NATIVE_TARGETS.some((target) => target.id === id)) return id as NativeTargetId;
  throw new Error(`Native builds are not configured for ${process.platform}/${process.arch}.`);
}

function requireValue(argv: readonly string[], index: number, option: string): string {
  const value = argv[index];
  if (!value) throw new Error(`${option} requires a value.`);
  return value;
}
