/**
 * Test: Render Remotion captions on a real video clip.
 * Usage: npx tsx test/test-real-clip.ts
 */
import { execSync } from "child_process";
import fs from "fs";
import path from "path";

const PROJECT_ROOT = path.resolve(__dirname, "..");
const PUBLIC_DIR = path.resolve(PROJECT_ROOT, "public");
const OUT_DIR = path.resolve(PROJECT_ROOT, "output", "test-real");
const CLIP_PATH = path.join(OUT_DIR, "clip-test.mp4");
const OUTPUT_PATH = path.join(OUT_DIR, "clip-captioned.mp4");
const PROPS_FILE = path.join(OUT_DIR, "props.json");

fs.mkdirSync(PUBLIC_DIR, { recursive: true });

// Copy clip to public/ for Remotion
const publicName = `real-clip-${Date.now()}.mp4`;
const publicPath = path.join(PUBLIC_DIR, publicName);
fs.copyFileSync(CLIP_PATH, publicPath);

// Sample words simulating what whisper would output (timestamps in ms)
const words = [
  // Group 1 (0-2s)
  { text: "Hey", start: 200, end: 500 },
  { text: "what's", start: 500, end: 800 },
  { text: "going", start: 800, end: 1100 },
  { text: "on", start: 1100, end: 1400 },
  // Group 2 (2-4s)
  { text: "welcome", start: 2000, end: 2500 },
  { text: "back", start: 2500, end: 2800 },
  { text: "to", start: 2800, end: 3000 },
  { text: "the", start: 3000, end: 3200 },
  // Group 3 (4-6s)
  { text: "channel", start: 3800, end: 4300 },
  { text: "today", start: 4300, end: 4700 },
  { text: "we're", start: 4700, end: 5000 },
  { text: "going", start: 5000, end: 5300 },
  // Group 4 (6-8s)
  { text: "to", start: 5800, end: 6000 },
  { text: "show", start: 6000, end: 6300 },
  { text: "you", start: 6300, end: 6500 },
  { text: "something", start: 6500, end: 7200 },
  // Group 5 (8-10s)
  { text: "really", start: 7800, end: 8200 },
  { text: "cool", start: 8200, end: 8600 },
  { text: "that", start: 8600, end: 8900 },
  { text: "works", start: 8900, end: 9400 },
  // Group 6 (10-12s)
  { text: "with", start: 10000, end: 10300 },
  { text: "video", start: 10300, end: 10700 },
  { text: "and", start: 10700, end: 10900 },
  { text: "captions", start: 10900, end: 11500 },
  // Group 7 (12-15s)
  { text: "let's", start: 12000, end: 12400 },
  { text: "get", start: 12400, end: 12700 },
  { text: "into", start: 12700, end: 13100 },
  { text: "it", start: 13100, end: 13400 },
];

const props = {
  videoSrc: publicName,
  words,
  highlightColor: "#FFD700",
  textColor: "#FFFFFF",
  fontSize: 68,
  position: "bottom",
  wordsPerGroup: 4,
  fontFamily: "Arial, sans-serif",
};

fs.writeFileSync(PROPS_FILE, JSON.stringify(props));

const entryPoint = path.resolve(PROJECT_ROOT, "src", "index.ts");
const fps = 30;
const durationFrames = 15 * fps; // 15 seconds

console.log("Rendering Remotion captions on real video clip...");
console.log(`  Input: ${CLIP_PATH}`);
console.log(`  Output: ${OUTPUT_PATH}`);
console.log(`  Frames: ${durationFrames}`);
console.log("");

try {
  execSync(
    [
      `npx remotion render`,
      `"${entryPoint}"`,
      `CaptionedClip`,
      `"${OUTPUT_PATH}"`,
      `--props="${PROPS_FILE}"`,
      `--width=1080`,
      `--height=1920`,
      `--frames=0-${durationFrames - 1}`,
      `--fps=${fps}`,
      `--codec=h264`,
    ].join(" "),
    {
      stdio: "inherit",
      timeout: 600000,
      cwd: PROJECT_ROOT,
    }
  );
  const size = fs.statSync(OUTPUT_PATH).size;
  console.log(`\nSUCCESS! Output: ${OUTPUT_PATH}`);
  console.log(`File size: ${(size / 1024 / 1024).toFixed(1)} MB`);
} catch (e) {
  console.error("\nRender failed:", e);
  process.exit(1);
} finally {
  if (fs.existsSync(PROPS_FILE)) fs.unlinkSync(PROPS_FILE);
  if (fs.existsSync(publicPath)) fs.unlinkSync(publicPath);
}
