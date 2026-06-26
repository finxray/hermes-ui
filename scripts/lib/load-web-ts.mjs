// Shared module-resolution hook so Node check scripts can import the web app's
// TypeScript sources directly (Node 22+ strips types natively). It resolves the
// "@/..." path alias to apps/web/src and appends ".ts" to extensionless
// relative/alias specifiers.
import { registerHooks } from "node:module";
import { pathToFileURL } from "node:url";
import path from "node:path";

const SRC_ROOT = pathToFileURL(path.join(process.cwd(), "apps", "web", "src") + path.sep).toString();

let registered = false;

export function registerWebTsResolver() {
  if (registered) {
    return;
  }
  registered = true;

  registerHooks({
    resolve(specifier, context, nextResolve) {
      // "@/foo/bar" -> apps/web/src/foo/bar(.ts)
      if (specifier.startsWith("@/")) {
        const target = new URL(specifier.slice(2), SRC_ROOT).toString();
        return nextResolve(withTsExtension(target), context);
      }
      // Extensionless relative imports -> add ".ts"
      if ((specifier.startsWith("./") || specifier.startsWith("../")) && !hasExtension(specifier)) {
        return nextResolve(`${specifier}.ts`, context);
      }
      return nextResolve(specifier, context);
    }
  });
}

function hasExtension(specifier) {
  return /\.[a-z]+$/i.test(specifier);
}

function withTsExtension(target) {
  return hasExtension(target) ? target : `${target}.ts`;
}
