import fs from "fs";
import path from "path";
import { transcribeVideo } from "./transcribe";
import { identifyClips } from "./identify-clips";
import { extractClipTimecodes } from "./extract-srt";
import { cutClips, cropToVertical, getVideoInfo } from "./cut-video";
import { detectFacePosition } from "./detect-face";
import { addCaptions } from "./add-captions";

export interface PipelineConfig {
  assemblyaiApiKey: string;
  anthropicApiKey: string;
  videoPath: string;
  outputDir: string;
  maxClips?: number;
  targetWidth?: number;
  targetHeight?: number;
  captionStyle?: {
    fontSize?: number;
    primaryColor?: string;
    outlineColor?: string;
    position?: "bottom" | "center" | "top";
    bold?: boolean;
  };
  skipTranscribe?: boolean;
  skipClipId?: boolean;
}

export async function runPipeline(config: PipelineConfig): Promise<void> {
  const {
    assemblyaiApiKey,
    anthropicApiKey,
    videoPath,
    outputDir,
    maxClips = 5,
    targetWidth = 1080,
    targetHeight = 1920,
    captionStyle = {},
    skipTranscribe = false,
    skipClipId = false,
  } = config;

  // Create output directory
  fs.mkdirSync(outputDir, { recursive: true });

  console.log("=".repeat(60));
  console.log("CONTENT CLIP MAGIC PIPELINE");
  console.log("=".repeat(60));
  console.log(`Video: ${videoPath}`);
  console.log(`Output: ${outputDir}`);
  console.log(`Max clips: ${maxClips}`);
  console.log(`Target: ${targetWidth}x${targetHeight}`);
  console.log("=".repeat(60));

  // ─── STEP 1: Get video info ─────────────────────────────────
  console.log("\n📹 STEP 1: Analyzing source video...");
  const videoInfo = getVideoInfo(videoPath);
  console.log(
    `  Source: ${videoInfo.width}x${videoInfo.height}, ${(videoInfo.durationMs / 1000).toFixed(1)}s`
  );

  // ─── STEP 2: Transcribe ─────────────────────────────────────
  let transcript: string;
  let srt: string;

  if (skipTranscribe) {
    console.log("\n📝 STEP 2: Loading existing transcript...");
    transcript = fs.readFileSync(path.join(outputDir, "transcript.txt"), "utf-8");
    srt = fs.readFileSync(path.join(outputDir, "transcript.srt"), "utf-8");
  } else {
    console.log("\n📝 STEP 2: Transcribing video...");
    const result = await transcribeVideo(assemblyaiApiKey, videoPath, outputDir);
    transcript = result.text;
    srt = result.srt;
  }

  // ─── STEP 3: Identify clips ────────────────────────────────
  let clips;

  if (skipClipId) {
    console.log("\n🎯 STEP 3: Loading existing clip segments...");
    clips = JSON.parse(
      fs.readFileSync(path.join(outputDir, "clips.json"), "utf-8")
    );
  } else {
    console.log("\n🎯 STEP 3: Identifying best clip segments...");
    clips = await identifyClips(
      anthropicApiKey,
      transcript,
      srt,
      outputDir,
      maxClips
    );
  }

  // ─── STEP 4: Extract SRT timecodes ─────────────────────────
  console.log("\n⏱️  STEP 4: Matching clips to SRT timestamps...");
  const timecodes = await extractClipTimecodes(clips, srt, outputDir);

  // ─── STEP 5: Cut clips from source video ───────────────────
  console.log("\n✂️  STEP 5: Cutting clips from source video...");
  const rawClips = await cutClips(videoPath, timecodes, outputDir);

  // ─── STEP 6: Detect face + crop to vertical ────────────────
  console.log("\n👤 STEP 6: Detecting faces and cropping to vertical...");
  const clipsDir = path.join(outputDir, "clips");

  for (const clip of rawClips) {
    console.log(`\n  Processing clip ${clip.clipNumber}...`);

    // Detect face position
    const face = await detectFacePosition(
      anthropicApiKey,
      clip.keyframePath,
      videoInfo.width,
      videoInfo.height
    );

    // Crop to vertical
    const verticalPath = path.join(
      clipsDir,
      `clip-${clip.clipNumber}-vertical.mp4`
    );
    await cropToVertical(
      clip.clipPath,
      verticalPath,
      videoInfo.width,
      videoInfo.height,
      face.x,
      face.y,
      targetWidth,
      targetHeight
    );

    // ─── STEP 7: Add captions ──────────────────────────────
    const tc = timecodes.find((t) => t.clipNumber === clip.clipNumber);
    if (tc) {
      const finalPath = path.join(
        clipsDir,
        `clip-${clip.clipNumber}-final.mp4`
      );
      await addCaptions(
        verticalPath,
        tc.srt,
        finalPath,
        targetWidth,
        targetHeight,
        captionStyle
      );
    }
  }

  // ─── DONE ──────────────────────────────────────────────────
  console.log("\n" + "=".repeat(60));
  console.log("PIPELINE COMPLETE!");
  console.log("=".repeat(60));
  console.log(`\nFinal clips saved to: ${clipsDir}`);
  console.log("Files:");

  const finalFiles = fs
    .readdirSync(clipsDir)
    .filter((f) => f.includes("-final."));
  for (const f of finalFiles) {
    console.log(`  ${f}`);
  }
}
