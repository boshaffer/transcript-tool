/**
 * Test script: renders the CaptionedClip composition with a test color-bar
 * video and sample word timestamps.
 *
 * Usage: npx tsx test/test-captions.ts
 */
import { execSync } from "child_process";
import fs from "fs";
import path from "path";

const PROJECT_ROOT = path.resolve(__dirname, "..");
const OUT_DIR = path.resolve(PROJECT_ROOT, "output", "test-captions");
const PUBLIC_DIR = path.resolve(PROJECT_ROOT, "public");
const TEST_VIDEO = path.join(OUT_DIR, "test-input.mp4");
const TEST_OUTPUT = path.join(OUT_DIR, "test-captioned.mp4");
const PROPS_FILE = path.join(OUT_DIR, "test-props.json");

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.mkdirSync(PUBLIC_DIR, { recursive: true });

// Step 1: Create a 5-second test video with ffmpeg (dark bg + silent audio)
console.log("Creating 5-second test video...");
execSync(
  `ffmpeg -y -f lavfi -i "color=c=0x1a1a2e:s=1080x1920:d=5:r=30" -f lavfi -i "anullsrc=r=44100:cl=stereo" -shortest -c:v libx264 -c:a aac -pix_fmt yuv420p "${TEST_VIDEO}"`,
  { stdio: "pipe" }
);

// Copy to public/ so Remotion can serve it
const publicVideoName = "test-input.mp4";
const publicVideoPath = path.join(PUBLIC_DIR, publicVideoName);
fs.copyFileSync(TEST_VIDEO, publicVideoPath);
console.log("  Test video:", TEST_VIDEO);

// Step 2: Build props with sample word timestamps (ms)
const words = [
  { text: "This", start: 0, end: 300 },
  { text: "is", start: 300, end: 500 },
  { text: "a", start: 500, end: 600 },
  { text: "test", start: 600, end: 1000 },
  { text: "of", start: 1200, end: 1400 },
  { text: "the", start: 1400, end: 1600 },
  { text: "caption", start: 1600, end: 2100 },
  { text: "system", start: 2100, end: 2600 },
  { text: "with", start: 2800, end: 3000 },
  { text: "word", start: 3000, end: 3300 },
  { text: "by", start: 3300, end: 3500 },
  { text: "word", start: 3500, end: 3800 },
  { text: "highlight", start: 4000, end: 4400 },
  { text: "animation", start: 4400, end: 5000 },
];

const props = {
  videoSrc: publicVideoName,
  words,
  highlightColor: "#FFD700",
  textColor: "#FFFFFF",
  fontSize: 68,
  position: "bottom",
  wordsPerGroup: 4,
  fontFamily: "Arial, sans-serif",
};

fs.writeFileSync(PROPS_FILE, JSON.stringify(props));
console.log("  Props:", PROPS_FILE);

// Step 3: Render with Remotion
const entryPoint = path.resolve(PROJECT_ROOT, "src", "index.ts");
console.log("\nRendering CaptionedClip with Remotion...");
console.log(`  Entry: ${entryPoint}`);
console.log(`  Output: ${TEST_OUTPUT}`);
console.log("");

try {
  execSync(
    [
      `npx remotion render`,
      `"${entryPoint}"`,
      `CaptionedClip`,
      `"${TEST_OUTPUT}"`,
      `--props="${PROPS_FILE}"`,
      `--width=1080`,
      `--height=1920`,
      `--frames=0-149`,
      `--fps=30`,
      `--codec=h264`,
    ].join(" "),
    {
      stdio: "inherit",
      timeout: 300000,
      cwd: PROJECT_ROOT,
    }
  );
  console.log("\nSUCCESS! Captioned video rendered to:", TEST_OUTPUT);
  console.log(
    "File size:",
    (fs.statSync(TEST_OUTPUT).size / 1024).toFixed(1),
    "KB"
  );
} catch (e) {
  console.error("\nRender failed:", e);
  process.exit(1);
} finally {
  if (fs.existsSync(PROPS_FILE)) fs.unlinkSync(PROPS_FILE);
  if (fs.existsSync(publicVideoPath)) fs.unlinkSync(publicVideoPath);
}
