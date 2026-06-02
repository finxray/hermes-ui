import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const outDir = join(root, "apps/web/public/patterns");
const outPath = join(outDir, "chat-depth-mesh.svg");

const width = 1440;
const height = 900;
const cols = 72;
const rows = 34;

function waveHeight(xNorm, depthNorm) {
  const left = 0.24 * Math.exp(-((xNorm - 0.2) ** 2) / 0.02);
  const middle = 1 * Math.exp(-((xNorm - 0.52) ** 2) / 0.011);
  const right = 0.42 * Math.exp(-((xNorm - 0.8) ** 2) / 0.018);
  const floor = 0.1 + depthNorm * 0.06;
  return floor + left + middle + right;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function dotColor(xNorm, heightValue) {
  const centerWeight = 1 - Math.min(1, Math.abs(xNorm - 0.52) * 1.65);
  const heightWeight = Math.min(1, heightValue * 0.95);
  const mix = Math.min(1, centerWeight * 0.72 + heightWeight * 0.28);
  const r = Math.round(lerp(48, 120, mix));
  const g = Math.round(lerp(92, 214, mix));
  const b = Math.round(lerp(150, 230, mix));
  return `rgb(${r}, ${g}, ${b})`;
}

const circles = [];

for (let row = 0; row < rows; row += 1) {
  const depthNorm = row / (rows - 1);
  const perspective = 0.35 + depthNorm * 0.58;
  const rowY = height * perspective;

  for (let col = 0; col < cols; col += 1) {
    const xNorm = col / (cols - 1);
    const x = 24 + xNorm * (width - 48);
    const heightValue = waveHeight(xNorm, depthNorm);
    const y = rowY - heightValue * (118 + depthNorm * 42);

    if (y < height * 0.34) {
      continue;
    }

    const sizeScale = 0.72 + depthNorm * 0.42;
    const radius = (0.45 + heightValue * 1.55) * sizeScale;
    const opacity = Math.min(
      0.16,
      0.035 + depthNorm * 0.07 + heightValue * 0.055 - (y < height * 0.48 ? (height * 0.48 - y) / height * 0.08 : 0)
    );

    if (opacity < 0.03 || radius < 0.28) {
      continue;
    }

    circles.push(
      `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${radius.toFixed(2)}" fill="${dotColor(xNorm, heightValue)}" fill-opacity="${opacity.toFixed(3)}"/>`
    );
  }
}

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
  <g>${circles.join("")}</g>
</svg>
`;

mkdirSync(outDir, { recursive: true });
writeFileSync(outPath, svg);
console.log(`Wrote ${outPath} (${Buffer.byteLength(svg)} bytes, ${circles.length} dots)`);
