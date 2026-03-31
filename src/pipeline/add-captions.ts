import { execSync } from "child_process";
import fs from "fs";
import path from "path";

interface Word {
  text: string;
  start: number;
  end: number;
}

interface CaptionConfig {
  fontSize?: number;
  highlightColor?: string;
  textColor?: string;
  position?: "bottom" | "center" | "top";
  wordsPerGroup?: number;
  fontFamily?: string;
}

function getVideoDurationInFrames(
  videoPath: string,
  fps: number
): number {
  const result = execSync(
    `ffprobe -v quiet -print_format json -show_format "${videoPath}"`,
    { encoding: "utf-8" }
  );
  const info = JSON.parse(result);
  const durationSec = parseFloat(info.format?.duration || "0");
  return Math.ceil(durationSec * fps);
}

export async function addCaptions(
  videoPath: string,
  words: Word[],
  outputPath: string,
  videoWidth: number = 1080,
  videoHeight: number = 1920,
  style: CaptionConfig = {}
): Promise<string> {
  const fps = 30;
  const durationInFrames = getVideoDurationInFrames(videoPath, fps);

  const {
    fontSize = 68,
    highlightColor = "#FFD700",
    textColor = "#FFFFFF",
    position = "bottom",
    wordsPerGroup = 4,
    fontFamily = "Inter, Arial, sans-serif",
  } = style;

  const projectRoot = path.resolve(__dirname, "..", "..");
  const publicDir = path.join(projectRoot, "public");
  fs.mkdirSync(publicDir, { recursive: true });

  // Copy video to public/ so Remotion can serve it via staticFile()
  const videoFilename = `clip-input-${Date.now()}.mp4`;
  const publicVideoPath = path.join(publicDir, videoFilename);
  fs.copyFileSync(path.resolve(videoPath), publicVideoPath);

  // Build the props JSON for Remotion — use staticFile path format
  const props = {
    videoSrc: videoFilename,
    words,
    highlightColor,
    textColor,
    fontSize,
    position,
    wordsPerGroup,
    fontFamily,
  };

  const propsPath = path.join(path.dirname(outputPath), `props-${Date.now()}.json`);
  fs.writeFileSync(propsPath, JSON.stringify(props));

  const entryPoint = path.resolve(__dirname, "..", "index.ts");
  const lastFrame = durationInFrames - 1;

  console.log(`  Rendering captions with Remotion (${durationInFrames} frames)...`);

  try {
    execSync(
      `npx remotion render "${entryPoint}" CaptionedClip "${outputPath}" --props="${propsPath}" --width=${videoWidth} --height=${videoHeight} --frames=0-${lastFrame} --fps=${fps} --codec=h264`,
      {
        stdio: "inherit",
        timeout: 600000, // 10 min
        cwd: projectRoot,
      }
    );
    console.log("  Captioned video saved:", outputPath);
  } finally {
    // Cleanup temp files
    if (fs.existsSync(propsPath)) fs.unlinkSync(propsPath);
    if (fs.existsSync(publicVideoPath)) fs.unlinkSync(publicVideoPath);
  }

  return outputPath;
}
