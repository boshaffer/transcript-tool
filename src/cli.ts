#!/usr/bin/env npx tsx
import { runPipeline, PipelineConfig } from "./pipeline/index";
import path from "path";

function printUsage() {
  console.log(`
Content Clip Magic - Turn long-form video into viral short clips

USAGE:
  npx tsx src/cli.ts <video-path> [options]

OPTIONS:
  --output, -o <dir>       Output directory (default: ./output/<video-name>)
  --max-clips, -n <num>    Max clips to generate (default: 5)
  --model, -m <path>       Path to whisper.cpp model file (auto-detected by default)
  --width <num>            Target width (default: 1080)
  --height <num>           Target height (default: 1920)
  --caption-size <num>     Caption font size (default: 22)
  --caption-color <hex>    Caption highlight color (default: #FFD700)
  --caption-pos <pos>      Caption position: bottom|center|top (default: bottom)
  --skip-transcribe        Skip transcription (use existing transcript.txt/srt)
  --skip-clip-id           Skip clip identification (use existing clips.json)

ENVIRONMENT VARIABLES:
  ANTHROPIC_API_KEY        Anthropic API key (for clip ID + face detection)
  WHISPER_CPP_PATH         Path to whisper.cpp binary (optional, auto-detected)
  WHISPER_MODEL_PATH       Path to whisper .bin model (optional, auto-detected)

PREREQUISITES:
  - ffmpeg + ffprobe (with libx264, libass)
  - whisper.cpp (https://github.com/ggerganov/whisper.cpp)
  - A whisper model (e.g. ggml-base.bin)

EXAMPLES:
  # Full pipeline
  npx tsx src/cli.ts ./input/podcast.mp4

  # Custom output and clip count
  npx tsx src/cli.ts ./input/podcast.mp4 -o ./output/my-clips -n 3

  # Specify whisper model
  npx tsx src/cli.ts ./input/podcast.mp4 -m ./models/ggml-small.bin

  # Resume from existing transcript
  npx tsx src/cli.ts ./input/podcast.mp4 --skip-transcribe

  # Custom captions
  npx tsx src/cli.ts ./input/podcast.mp4 --caption-size 28 --caption-color "#FFD700" --caption-pos center
`);
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    printUsage();
    process.exit(0);
  }

  const videoPath = path.resolve(args[0]);

  // Parse options
  let outputDir = "";
  let whisperModel: string | undefined;
  let maxClips = 5;
  let targetWidth = 1080;
  let targetHeight = 1920;
  let captionSize = 22;
  let captionColor = "#FFD700";
  let captionPos: "bottom" | "center" | "top" = "bottom";
  let skipTranscribe = false;
  let skipClipId = false;

  for (let i = 1; i < args.length; i++) {
    switch (args[i]) {
      case "--output":
      case "-o":
        outputDir = args[++i];
        break;
      case "--model":
      case "-m":
        whisperModel = args[++i];
        break;
      case "--max-clips":
      case "-n":
        maxClips = parseInt(args[++i], 10);
        break;
      case "--width":
        targetWidth = parseInt(args[++i], 10);
        break;
      case "--height":
        targetHeight = parseInt(args[++i], 10);
        break;
      case "--caption-size":
        captionSize = parseInt(args[++i], 10);
        break;
      case "--caption-color":
        captionColor = args[++i];
        break;
      case "--caption-pos":
        captionPos = args[++i] as "bottom" | "center" | "top";
        break;
      case "--skip-transcribe":
        skipTranscribe = true;
        break;
      case "--skip-clip-id":
        skipClipId = true;
        break;
    }
  }

  if (!outputDir) {
    const videoName = path.basename(videoPath, path.extname(videoPath));
    outputDir = path.resolve("./output", videoName);
  }

  const anthropicApiKey = process.env.ANTHROPIC_API_KEY;

  if (!anthropicApiKey) {
    console.error("Error: ANTHROPIC_API_KEY environment variable is required");
    console.error("  (used for clip identification and face detection)");
    process.exit(1);
  }

  const config: PipelineConfig = {
    anthropicApiKey,
    videoPath,
    outputDir,
    whisperModel,
    maxClips,
    targetWidth,
    targetHeight,
    captionStyle: {
      fontSize: captionSize,
      highlightColor: captionColor,
      position: captionPos,
    },
    skipTranscribe,
    skipClipId,
  };

  try {
    await runPipeline(config);
  } catch (error) {
    console.error("\nPipeline failed:", error);
    process.exit(1);
  }
}

main();
