import { NextResponse } from "next/server";
import appPackage from "../../../../package.json";
import {
  compareVersions,
  DEFAULT_GITHUB_RELEASE_API_URL,
  parseUpdateChannel,
  parseGitHubLatestRelease,
  parseUpdateManifest,
  selectUpdateArtifact,
  type AppUpdateResponse
} from "@/lib/appUpdate";

export const dynamic = "force-dynamic";

const requestTimeoutMs = 5_000;

export async function GET(request: Request) {
  const channel = parseUpdateChannel(new URL(request.url).searchParams.get("channel"));
  const currentVersion = appPackage.version;
  const configuredManifestUrl = resolveConfiguredManifestUrl(channel);

  if (configuredManifestUrl) {
    return checkConfiguredManifest(configuredManifestUrl, channel, currentVersion);
  }

  if (channel !== "stable") {
    return NextResponse.json<AppUpdateResponse>({
      artifact: null,
      channel,
      currentVersion,
      latestVersion: null,
      manifest: null,
      status: "unconfigured"
    });
  }

  return checkLatestGitHubRelease(channel, currentVersion);
}

async function checkLatestGitHubRelease(channel: "stable", currentVersion: string) {
  try {
    const response = await fetch(DEFAULT_GITHUB_RELEASE_API_URL, {
      cache: "no-store",
      headers: {
        accept: "application/vnd.github+json",
        "user-agent": `Stoix/${currentVersion}`
      },
      signal: AbortSignal.timeout(requestTimeoutMs)
    });

    if (response.status === 404) {
      return currentResponse(channel, currentVersion);
    }
    if (!response.ok) {
      return updateError(channel, currentVersion, `GitHub Releases returned HTTP ${response.status}.`);
    }

    const release = parseGitHubLatestRelease(await response.json());
    if (!release) {
      return updateError(channel, currentVersion, "GitHub returned invalid release metadata.");
    }

    const updateAvailable = compareVersions(release.version, currentVersion) > 0;
    return NextResponse.json<AppUpdateResponse>({
      artifact: null,
      channel,
      currentVersion,
      latestVersion: release.version,
      manifest: {
        notes: release.name ? [release.name] : [],
        publishedAt: release.publishedAt,
        releaseUrl: release.releaseUrl
      },
      status: updateAvailable ? "update-available" : "current"
    });
  } catch (error) {
    return updateError(
      channel,
      currentVersion,
      error instanceof Error ? error.message : "GitHub Releases could not be reached."
    );
  }
}

async function checkConfiguredManifest(
  manifestUrl: string,
  channel: "stable" | "beta",
  currentVersion: string
) {

  if (!isAllowedManifestUrl(manifestUrl)) {
    return updateError(channel, currentVersion, "The configured update manifest URL must use HTTPS.");
  }

  try {
    const response = await fetch(manifestUrl, {
      cache: "no-store",
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(requestTimeoutMs)
    });
    if (!response.ok) {
      return updateError(channel, currentVersion, `Update service returned HTTP ${response.status}.`);
    }

    const manifest = parseUpdateManifest(await response.json());
    if (!manifest || manifest.channel !== channel) {
      return updateError(channel, currentVersion, "The update manifest is invalid or belongs to another channel.");
    }

    const updateAvailable = compareVersions(manifest.version, currentVersion) > 0;
    return NextResponse.json<AppUpdateResponse>({
      artifact: updateAvailable ? selectUpdateArtifact(manifest, process.platform, process.arch) : null,
      channel,
      currentVersion,
      latestVersion: manifest.version,
      manifest: {
        notes: manifest.notes,
        publishedAt: manifest.publishedAt,
        releaseUrl: manifest.releaseUrl
      },
      status: updateAvailable ? "update-available" : "current"
    });
  } catch (error) {
    return updateError(
      channel,
      currentVersion,
      error instanceof Error ? error.message : "The update service could not be reached."
    );
  }
}

function currentResponse(channel: "stable" | "beta", currentVersion: string) {
  return NextResponse.json<AppUpdateResponse>({
    artifact: null,
    channel,
    currentVersion,
    latestVersion: currentVersion,
    manifest: null,
    status: "current"
  });
}

function updateError(channel: "stable" | "beta", currentVersion: string, error: string) {
  return NextResponse.json<AppUpdateResponse>(
    {
      artifact: null,
      channel,
      currentVersion,
      error,
      latestVersion: null,
      manifest: null,
      status: "error"
    },
    { status: 502 }
  );
}

function isAllowedManifestUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || (process.env.NODE_ENV !== "production" && isLoopback(url.hostname));
  } catch {
    return false;
  }
}

function isLoopback(hostname: string) {
  return hostname === "127.0.0.1" || hostname === "::1" || hostname === "localhost";
}

function resolveConfiguredManifestUrl(channel: "stable" | "beta") {
  const configuredUrl = process.env.HERMES_UI_UPDATE_MANIFEST_URL?.trim();
  if (configuredUrl) return configuredUrl.replace("{channel}", channel);
  return "";
}
