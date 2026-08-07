export function isTrustedMutationRequest(request: Request) {
  if (request.headers.get("sec-fetch-site") === "cross-site") return false;

  const origin = request.headers.get("origin");
  if (!origin) return true;

  try {
    const originUrl = new URL(origin);
    const requestUrl = new URL(request.url);
    if (originUrl.origin === requestUrl.origin) {
      return true;
    }

    // Next can represent a loopback request internally with the other common
    // loopback alias. Keep the same-port boundary while treating localhost and
    // 127.0.0.1 as the same local application origin.
    return (
      isLoopbackHostname(originUrl.hostname) &&
      isLoopbackHostname(requestUrl.hostname) &&
      effectivePort(originUrl) === effectivePort(requestUrl)
    );
  } catch {
    return false;
  }
}

function isLoopbackHostname(hostname: string) {
  const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  return normalized === "localhost" || normalized === "127.0.0.1" || normalized === "::1";
}

function effectivePort(url: URL) {
  return url.port || (url.protocol === "https:" ? "443" : url.protocol === "http:" ? "80" : "");
}
