import { readFileSync } from "node:fs";
import process from "node:process";
import { URL } from "node:url";

const tokens = readFileSync(
  new URL("../src/styles/tokens.css", import.meta.url),
  "utf8",
);

function color(value) {
  const hex = value.startsWith("--")
    ? tokens.match(new RegExp(`${value}:\\s*(#[0-9a-f]{6})`, "i"))?.[1]
    : value;
  if (!hex || !/^#[0-9a-f]{6}$/i.test(hex))
    throw new Error(`Unknown color: ${value}`);
  return [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16));
}

function blend(foreground, background, alpha) {
  return foreground.map((channel, index) =>
    Math.round(channel * alpha + background[index] * (1 - alpha)),
  );
}

function luminance(rgb) {
  const linear = rgb.map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
}

function contrast(foreground, background) {
  const values = [luminance(foreground), luminance(background)].sort(
    (a, b) => b - a,
  );
  return (values[0] + 0.05) / (values[1] + 0.05);
}

const glassOnSky = blend(color("#fff8f1"), color("--sky-top"), 0.9);
const glassOnGround = blend(color("#fff8f1"), color("--ground"), 0.9);
const dockOnGround = blend(color("#ffddc9"), color("--ground"), 0.9);
const checks = [
  ["title on blue sky", color("--ink"), color("--sky-top")],
  ["LCD ink on screen", color("--lcd-ink"), color("--lcd-screen")],
  ["glass secondary text on sky", color("--glass-text-soft"), glassOnSky],
  ["glass secondary text on ground", color("--glass-text-soft"), glassOnGround],
  ["panel action text", color("#fffaf5"), color("--plum")],
  ["empty-state accent", color("#754283"), glassOnSky],
  ["ASCII empty art", color("#77538a"), glassOnSky],
  ["dock artist", color("#654964"), dockOnGround],
];

let failed = false;
for (const [label, foreground, background] of checks) {
  const ratio = contrast(foreground, background);
  process.stdout.write(`${label}: ${ratio.toFixed(2)}:1\n`);
  failed ||= ratio < 4.5;
}
if (failed) process.exitCode = 1;
