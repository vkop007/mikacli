import packageJson from "../package.json" with { type: "json" };

export const NATIVE_DISTRIBUTION_SCHEMA_VERSION = 1 as const;
export const NATIVE_MANIFEST_FILENAME = "mikacli-native-manifest.json";

export type NativeTargetId =
  | "darwin-arm64"
  | "darwin-x64"
  | "linux-arm64"
  | "linux-x64"
  | "windows-x64";

export type NativeTarget = {
  id: NativeTargetId;
  os: "darwin" | "linux" | "win32";
  arch: "arm64" | "x64";
  bunTarget: string;
  assetName: string;
  npmPackage: string;
};

export const NATIVE_TARGETS: readonly NativeTarget[] = [
  {
    id: "darwin-arm64",
    os: "darwin",
    arch: "arm64",
    bunTarget: "bun-darwin-arm64",
    assetName: "mikacli-darwin-arm64",
    npmPackage: "@vk007/mikacli-darwin-arm64",
  },
  {
    id: "darwin-x64",
    os: "darwin",
    arch: "x64",
    bunTarget: "bun-darwin-x64",
    assetName: "mikacli-darwin-x64",
    npmPackage: "@vk007/mikacli-darwin-x64",
  },
  {
    id: "linux-arm64",
    os: "linux",
    arch: "arm64",
    bunTarget: "bun-linux-arm64",
    assetName: "mikacli-linux-arm64",
    npmPackage: "@vk007/mikacli-linux-arm64",
  },
  {
    id: "linux-x64",
    os: "linux",
    arch: "x64",
    bunTarget: "bun-linux-x64",
    assetName: "mikacli-linux-x64",
    npmPackage: "@vk007/mikacli-linux-x64",
  },
  {
    id: "windows-x64",
    os: "win32",
    arch: "x64",
    bunTarget: "bun-windows-x64",
    assetName: "mikacli-windows-x64.exe",
    npmPackage: "@vk007/mikacli-windows-x64",
  },
] as const;

export type NativeArtifactDigest = {
  filename: string;
  url: string;
  size: number;
  sha256: string;
  integrity: string;
};

export type NativeManifestArtifact = {
  target: NativeTargetId;
  os: NativeTarget["os"];
  arch: NativeTarget["arch"];
  executable: NativeArtifactDigest;
  npm: NativeArtifactDigest & { package: string };
};

export type NativeDistributionManifest = {
  schemaVersion: typeof NATIVE_DISTRIBUTION_SCHEMA_VERSION;
  package: { name: string; version: string };
  generatedAt: string;
  catalog: {
    schemaVersion: number;
    revision: string;
    providerCount: number;
    stateSchemaVersion: number;
  };
  protocols: {
    mcp: string;
    management: string;
  };
  distribution: {
    format: "standalone-executable";
    requiresNode: false;
    manifestUrl: string;
  };
  artifacts: NativeManifestArtifact[];
};

export function nativeReleaseBaseUrl(version = packageJson.version): string {
  return `https://github.com/vkop007/mikacli/releases/download/v${version}`;
}

export function nativeManifestUrl(version = packageJson.version): string {
  return `${nativeReleaseBaseUrl(version)}/${NATIVE_MANIFEST_FILENAME}`;
}

export function npmTarballUrl(target: NativeTarget, version = packageJson.version): string {
  const unscopedName = target.npmPackage.slice(target.npmPackage.lastIndexOf("/") + 1);
  return `https://registry.npmjs.org/${target.npmPackage}/-/${unscopedName}-${version}.tgz`;
}

export function getNativeDistributionDescriptor(version = packageJson.version): Record<string, unknown> {
  return {
    schemaVersion: NATIVE_DISTRIBUTION_SCHEMA_VERSION,
    format: "standalone-executable",
    requiresNode: false,
    checksumAlgorithm: "sha256",
    integrityAlgorithm: "sha256",
    manifestUrl: nativeManifestUrl(version),
    targets: NATIVE_TARGETS.map((target) => ({
      target: target.id,
      os: target.os,
      arch: target.arch,
      npmPackage: target.npmPackage,
      npmTarballUrl: npmTarballUrl(target, version),
      executableUrl: `${nativeReleaseBaseUrl(version)}/${target.assetName}`,
      checksumSource: nativeManifestUrl(version),
    })),
  };
}
