export const DEFAULT_HERMES_API_BASE_URL = "http://127.0.0.1:8642";

export function configuredHermesApiBaseUrl(
  environment: NodeJS.ProcessEnv = process.env
): string {
  return environment.HERMES_API_BASE_URL?.trim() || DEFAULT_HERMES_API_BASE_URL;
}
