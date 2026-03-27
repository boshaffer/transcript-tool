import { execSync } from "child_process";
import fs from "fs";
import path from "path";

interface CutResult {
  clipNumber: number;
  clipPath: string;
  keyframePath: string;
  durationMs: number;
}

export async function cutClips(
  videoPath: string,
  timecodes: Array<{
    clipNumber: number;
    startMs: number;
    endMs: number;
    durationMs: number;
  }>,
  outputDir: string
): Promise<CutResult[]> {
  console.log("[Cut Video] Extracting clips from source video...");

  const clipsDir = path.join(outputDir, "clips");
  fs.mkdirSync(clipsDir, { recursive: true });

  const results: CutResult[] = [];

  for (const tc of timecodes) {
    const startSec = tc.startMs / 1000;
    const durationSec = tc.durationMs / 1000;
    const clipPath = path.join(clipsDir, `clip-${tc.clipNumber}-raw.mp4`);
    const keyframePath = path.join(
      clipsDir,
      `clip-${tc.clipNumber}-keyframe.jpg`
    );

    console.log(
      `  Cutting clip ${tc.clipNumber}: ${durationSec.toFixed(1)}s starting at ${startSec.toFixed(1)}s`
    );

    // Cut the clip from the source video
    execSync(
      `ffmpeg -y -ss ${startSec} -i "${videoPath}" -t ${durationSec} -c:v libx264 -c:a aac -avoid_negative_ts make_zero "${clipPath}"`,
      { stdio: "pipe" }
    );

    // Extract a keyframe image from the middle of the clip
    const midpointSec = startSec + durationSec / 2;
    execSync(
      `ffmpeg -y -ss ${midpointSec} -i "${videoPath}" -frames:v 1 -q:v 2 "${keyframePath}"`,
      { stdio: "pipe" }
    );

    results.push({
      clipNumber: tc.clipNumber,
      clipPath,
      keyframePath,
      durationMs: tc.durationMs,
    });

    console.log(`  Clip ${tc.clipNumber} saved: ${clipPath}`);
  }

  return results;
}

export async function cropToVertical(
  clipPath: string,
  outputPath: string,
  sourceWidth: number,
  sourceHeight: number,
  faceX: number,
  faceY: number,
  targetWidth: number = 1080,
  targetHeight: number = 1920
): Promise<string> {
  // Calculate the crop area centered on the face
  const targetAspect = targetWidth / targetHeight;
  let cropWidth = Math.round(sourceHeight * targetAspect);
  let cropHeight = sourceHeight;

  // If crop width is larger than source, adjust
  if (cropWidth > sourceWidth) {
    cropWidth = sourceWidth;
    cropHeight = Math.round(sourceWidth / targetAspect);
  }

  // Center the crop on the face X position
  let cropX = Math.round(faceX - cropWidth / 2);
  let cropY = Math.round(faceY - cropHeight / 2);

  // Clamp to video bounds
  cropX = Math.max(0, Math.min(cropX, sourceWidth - cropWidth));
  cropY = Math.max(0, Math.min(cropY, sourceHeight - cropHeight));

  console.log(
    `  Cropping: ${cropWidth}x${cropHeight} at (${cropX},${cropY}) -> ${targetWidth}x${targetHeight}`
  );

  execSync(
    `ffmpeg -y -i "${clipPath}" -vf "crop=${cropWidth}:${cropHeight}:${cropX}:${cropY},scale=${targetWidth}:${targetHeight}" -c:v libx264 -c:a aac "${outputPath}"`,
    { stdio: "pipe" }
  );

  return outputPath;
}

export function getVideoInfo(videoPath: string): {
  width: number;
  height: number;
  durationMs: number;
} {
  const result = execSync(
    `ffprobe -v quiet -print_format json -show_streams -show_format "${videoPath}"`,
    { encoding: "utf-8" }
  );
  const info = JSON.parse(result);
  const videoStream = info.streams.find(
    (s: any) => s.codec_type === "video"
  );

  return {
    width: videoStream?.width || 1920,
    height: videoStream?.height || 1080,
    durationMs: Math.round(parseFloat(info.format?.duration || "0") * 1000),
  };
}
