#!/usr/bin/env node

/**
 * Encodes scroll-arrow SVGs into data URLs for each scrollbar button direction.
 * Source: assets/icons/scroll-triangle-rounded.svg (rounded triangle, no flat base)
 * ViewBox is cropped to the path bounds so the icon fills the 9px button without
 * scaling past 100% (which clips the tip and looks like a "house").
 * Re-run after changing fill color: node scripts/encode-scroll-arrows.mjs ["rgba(180, 176, 183, 0.192)"]
 */

const color = process.argv[2] ?? "rgba(180, 176, 183, 0.192)";
const viewBox = "0 0 35 35";
const cx = 17.5;
const cy = 17.5;
const pathD =
  "M6.109 32h22.783c4.027 0 6.465-4.448 4.3-7.843L21.8 6.295c-2.005-3.144-6.596-3.144-8.601 0L1.808 24.157C-0.357 27.552 2.082 32 6.109 32z";

const rotations = {
  up: 0,
  down: 180,
  right: 90,
  left: -90,
};

function svgFor(direction) {
  const rotate = rotations[direction];
  const transform =
    rotate === 0 ? "" : `<g transform="rotate(${rotate} ${cx} ${cy})">`;
  const close = rotate === 0 ? "" : "</g>";

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">${transform}<path fill="${color}" d="${pathD}"/>${close}</svg>`;
}

function toDataUrl(svg) {
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

const mapping = {
  down: "vertical:increment",
  up: "vertical:decrement",
  right: "horizontal:increment",
  left: "horizontal:decrement",
};

for (const [direction, selectorSuffix] of Object.entries(mapping)) {
  console.log(`${selectorSuffix} (${direction}):`);
  console.log(toDataUrl(svgFor(direction)));
  console.log();
}
