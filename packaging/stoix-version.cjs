"use strict";

function normalizedSemanticVersion(value) {
  const match = String(value || "").match(
    /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/
  );
  return match
    ? `${Number(match[1])}.${Number(match[2])}.${Number(match[3])}${match[4] ? `-${match[4]}` : ""}`
    : null;
}

function compareSemanticVersions(leftValue, rightValue) {
  const left = semanticVersionParts(leftValue);
  const right = semanticVersionParts(rightValue);
  for (let index = 0; index < 3; index += 1) {
    if (left.core[index] !== right.core[index]) return left.core[index] - right.core[index];
  }
  if (!left.prerelease && !right.prerelease) return 0;
  if (!left.prerelease) return 1;
  if (!right.prerelease) return -1;
  const length = Math.max(left.prerelease.length, right.prerelease.length);
  for (let index = 0; index < length; index += 1) {
    if (left.prerelease[index] === undefined) return -1;
    if (right.prerelease[index] === undefined) return 1;
    const leftPart = left.prerelease[index];
    const rightPart = right.prerelease[index];
    if (leftPart === rightPart) continue;
    const leftNumber = /^\d+$/.test(leftPart) ? Number(leftPart) : null;
    const rightNumber = /^\d+$/.test(rightPart) ? Number(rightPart) : null;
    if (leftNumber !== null && rightNumber !== null) return leftNumber - rightNumber;
    if (leftNumber !== null) return -1;
    if (rightNumber !== null) return 1;
    return leftPart.localeCompare(rightPart);
  }
  return 0;
}

function semanticVersionParts(value) {
  const normalized = normalizedSemanticVersion(value);
  if (!normalized) throw new Error(`Invalid Stoix version: ${value}`);
  const separator = normalized.indexOf("-");
  const core = separator === -1 ? normalized : normalized.slice(0, separator);
  const prerelease = separator === -1 ? "" : normalized.slice(separator + 1);
  return {
    core: core.split(".").map(Number),
    prerelease: prerelease ? prerelease.split(".") : null
  };
}

module.exports = { compareSemanticVersions, normalizedSemanticVersion };
