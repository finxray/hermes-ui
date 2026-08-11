#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";

const root = process.cwd();
const helperPath = resolve(root, "apps/web/src/lib/server/requestTrust.ts");
const helper = await importTypeScriptModule(helperPath);

assert.equal(helper.isTrustedMutationRequest(new Request("http://127.0.0.1:3000/api/test")), true);
assert.equal(
  helper.isTrustedMutationRequest(new Request("http://127.0.0.1:3000/api/test", {
    headers: { origin: "http://127.0.0.1:3000" }
  })),
  true
);
assert.equal(
  helper.isTrustedMutationRequest(new Request("http://127.0.0.1:3000/api/test", {
    headers: { origin: "http://localhost:3000", "sec-fetch-site": "same-origin" }
  })),
  true
);
assert.equal(
  helper.isTrustedMutationRequest(new Request("http://localhost:3000/api/test", {
    headers: { origin: "http://127.0.0.1:3000", "sec-fetch-site": "same-origin" }
  })),
  true
);
assert.equal(
  helper.isTrustedMutationRequest(new Request("http://127.0.0.1:3000/api/test", {
    headers: { origin: "http://localhost:3001", "sec-fetch-site": "same-origin" }
  })),
  false
);
assert.equal(
  helper.isTrustedMutationRequest(new Request("http://127.0.0.1:3000/api/test", {
    headers: { origin: "https://malicious.example", "sec-fetch-site": "cross-site" }
  })),
  false
);

const protectedRoutes = [
  "apps/web/src/app/api/attachments/route.ts",
  "apps/web/src/app/api/attachments/[id]/route.ts",
  "apps/web/src/app/api/attachments/link/route.ts",
  "apps/web/src/app/api/hermes/chat/stream/route.ts",
  "apps/web/src/app/api/hermes/chat/title/route.ts",
  "apps/web/src/app/api/hermes/plugins/[id]/route.ts",
  "apps/web/src/app/api/hermes/model/select/route.ts",
  "apps/web/src/app/api/hermes/skills/[id]/route.ts",
  "apps/web/src/app/api/hermes/sessions/[id]/route.ts"
];

for (const path of protectedRoutes) {
  const source = readFileSync(resolve(root, path), "utf8");
  assert(source.includes("isTrustedMutationRequest(request)"), `${path} must reject cross-origin mutation requests`);
}

const webPackage = JSON.parse(readFileSync(resolve(root, "apps/web/package.json"), "utf8"));
assert(webPackage.scripts.dev.includes("--hostname 127.0.0.1"));
assert(webPackage.scripts.start.includes("--hostname 127.0.0.1"));

console.log("Local request trust checks passed.");

async function importTypeScriptModule(path) {
  const source = readFileSync(path, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
    fileName: path
  });
  return import(`data:text/javascript;base64,${Buffer.from(compiled.outputText).toString("base64")}`);
}
