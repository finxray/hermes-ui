export const UPDATE_CHANNELS = ["stable", "beta"] as const;
export const UPDATE_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1_000;
export const DEFAULT_GITHUB_RELEASE_API_URL =
  "https://api.github.com/repos/finxray/hermes-ui/releases/latest";

export type UpdateChannel = (typeof UPDATE_CHANNELS)[number];
export type UpdatePlatform = "darwin" | "linux" | "win32";
export type UpdateArchitecture = "arm64" | "x64";

export type UpdateArtifact = {
  arch: UpdateArchitecture;
  platform: UpdatePlatform;
  sha256: string;
  signature: string;
  url: string;
};

export type UpdateManifest = {
  artifacts: UpdateArtifact[];
  channel: UpdateChannel;
  notes: string[];
  publishedAt: string;
  releaseUrl: string;
  schemaVersion: 1;
  signature: string;
  version: string;
};

export type AppUpdateResponse = {
  artifact: UpdateArtifact | null;
  channel: UpdateChannel;
  currentVersion: string;
  error?: string;
  latestVersion: string | null;
  manifest: Pick<UpdateManifest, "notes" | "publishedAt" | "releaseUrl"> | null;
  status: "current" | "error" | "unconfigured" | "update-available";
};

export type GitHubLatestRelease = {
  name: string;
  publishedAt: string;
  releaseUrl: string;
  version: string;
};

export function parseUpdateChannel(value: string | null | undefined): UpdateChannel {
  return value === "beta" ? "beta" : "stable";
}

export function compareVersions(left: string, right: string) {
  const leftParts = parseVersion(left);
  const rightParts = parseVersion(right);
  if (!leftParts || !rightParts) return 0;

  const leftCore = [leftParts.major, leftParts.minor, leftParts.patch];
  const rightCore = [rightParts.major, rightParts.minor, rightParts.patch];
  for (let index = 0; index < leftCore.length; index += 1) {
    const difference = leftCore[index] - rightCore[index];
    if (difference !== 0) return difference;
  }

  if (leftParts.prerelease.length === 0 && rightParts.prerelease.length === 0) return 0;
  if (leftParts.prerelease.length === 0) return 1;
  if (rightParts.prerelease.length === 0) return -1;

  const identifierCount = Math.max(leftParts.prerelease.length, rightParts.prerelease.length);
  for (let index = 0; index < identifierCount; index += 1) {
    const leftIdentifier = leftParts.prerelease[index];
    const rightIdentifier = rightParts.prerelease[index];
    if (leftIdentifier === undefined) return -1;
    if (rightIdentifier === undefined) return 1;
    if (leftIdentifier === rightIdentifier) continue;

    const leftNumeric = /^\d+$/.test(leftIdentifier);
    const rightNumeric = /^\d+$/.test(rightIdentifier);
    if (leftNumeric && rightNumeric) return Number(leftIdentifier) - Number(rightIdentifier);
    if (leftNumeric) return -1;
    if (rightNumeric) return 1;
    return leftIdentifier.localeCompare(rightIdentifier);
  }

  return 0;
}

export function isUpdateCheckDue(lastCheckedAt: number | null, now = Date.now()) {
  return lastCheckedAt === null || now - lastCheckedAt >= UPDATE_CHECK_INTERVAL_MS;
}

export function parseUpdateManifest(value: unknown): UpdateManifest | null {
  if (!isRecord(value) || value.schemaVersion !== 1) return null;
  if (!UPDATE_CHANNELS.includes(value.channel as UpdateChannel)) return null;
  if (!isVersion(value.version) || !isIsoDate(value.publishedAt)) return null;
  if (!isHttpsUrl(value.releaseUrl) || !isNonEmptyString(value.signature)) return null;
  if (!Array.isArray(value.notes) || !value.notes.every(isNonEmptyString)) return null;
  if (!Array.isArray(value.artifacts)) return null;

  const artifacts = value.artifacts.map(parseArtifact);
  if (artifacts.some((artifact) => artifact === null)) return null;

  return {
    artifacts: artifacts as UpdateArtifact[],
    channel: value.channel as UpdateChannel,
    notes: value.notes,
    publishedAt: value.publishedAt,
    releaseUrl: value.releaseUrl,
    schemaVersion: 1,
    signature: value.signature,
    version: value.version
  };
}

export function parseGitHubLatestRelease(value: unknown): GitHubLatestRelease | null {
  if (!isRecord(value) || value.draft !== false || value.prerelease !== false) return null;
  if (typeof value.tag_name !== "string" || !parseVersion(value.tag_name)) return null;
  if (typeof value.html_url !== "string" || !isHermesGitHubReleaseUrl(value.html_url)) return null;
  if (typeof value.published_at !== "string" || !Number.isFinite(Date.parse(value.published_at))) return null;

  return {
    name: typeof value.name === "string" ? value.name.trim() : "",
    publishedAt: value.published_at,
    releaseUrl: value.html_url,
    version: value.tag_name.trim().replace(/^v/, "")
  };
}

export function selectUpdateArtifact(
  manifest: UpdateManifest,
  platform: NodeJS.Platform,
  arch: string
) {
  if (!isUpdatePlatform(platform) || !isUpdateArchitecture(arch)) return null;
  return manifest.artifacts.find((artifact) => artifact.platform === platform && artifact.arch === arch) ?? null;
}

function parseArtifact(value: unknown): UpdateArtifact | null {
  if (!isRecord(value)) return null;
  if (!isUpdatePlatform(value.platform) || !isUpdateArchitecture(value.arch)) return null;
  if (!isHttpsUrl(value.url) || typeof value.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(value.sha256)) return null;
  if (!isNonEmptyString(value.signature)) return null;
  return {
    arch: value.arch,
    platform: value.platform,
    sha256: value.sha256,
    signature: value.signature,
    url: value.url
  };
}

function parseVersion(value: string) {
  const match = value
    .trim()
    .match(/^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/);
  if (!match) return null;
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease: match[4] ? match[4].split(".") : []
  };
}

function isVersion(value: unknown): value is string {
  return typeof value === "string" && /^v?\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(value.trim());
}

function isIsoDate(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function isHttpsUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function isHermesGitHubReleaseUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" &&
      url.hostname === "github.com" &&
      url.pathname.startsWith("/finxray/hermes-ui/releases/");
  } catch {
    return false;
  }
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isUpdatePlatform(value: unknown): value is UpdatePlatform {
  return value === "darwin" || value === "linux" || value === "win32";
}

function isUpdateArchitecture(value: unknown): value is UpdateArchitecture {
  return value === "arm64" || value === "x64";
}
