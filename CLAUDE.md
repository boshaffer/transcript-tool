# Content Clip Magic - Claude Code Guide

## Project Overview
AI-powered pipeline that takes long-form video and produces viral short-form clips with captions for YouTube Shorts, TikTok, and Instagram Reels.

## Pipeline Workflow
```
Raw Video → Transcribe (AssemblyAI) → Identify Clips (Claude) → Extract SRT Timecodes
→ Cut Clips (ffmpeg) → Detect Face (Claude Vision) → Crop to Vertical (ffmpeg)
→ Add Captions (ffmpeg+ASS) → Final Clips Ready for Social Media
```

## Quick Start
```bash
# Set API keys
export ASSEMBLYAI_API_KEY="your-key"
export ANTHROPIC_API_KEY="your-key"

# Run the full pipeline
npm run clip ./input/my-podcast.mp4

# With options
npm run clip -- ./input/my-podcast.mp4 -n 3 -o ./output/my-clips --caption-pos center
```

## CLI Options
```
npx tsx src/cli.ts <video-path> [options]

--output, -o <dir>       Output directory (default: ./output/<video-name>)
--max-clips, -n <num>    Max clips to generate (default: 5)
--width <num>            Target width (default: 1080)
--height <num>           Target height (default: 1920)
--caption-size <num>     Caption font size (default: 22)
--caption-color <hex>    Caption color (default: #FFFFFF)
--caption-pos <pos>      Caption position: bottom|center|top (default: bottom)
--skip-transcribe        Skip transcription (use existing transcript)
--skip-clip-id           Skip clip identification (use existing clips.json)
```

## Project Structure
```
src/
  cli.ts                  — CLI entry point
  index.ts                — Remotion entry point
  Root.tsx                — Registers Remotion compositions
  styles.css              — TailwindCSS v4 styles
  pipeline/
    index.ts              — Pipeline orchestrator
    transcribe.ts         — AssemblyAI transcription + SRT generation
    identify-clips.ts     — Claude AI clip identification
    extract-srt.ts        — SRT timestamp matching for each clip
    cut-video.ts          — ffmpeg video cutting + vertical cropping
    detect-face.ts        — Claude Vision face detection for smart crop
    add-captions.ts       — ASS subtitle generation + caption burn-in
  compositions/           — Remotion video compositions
    TextOverlay.tsx       — Animated text on colored background
    ImageSlideshow.tsx    — Slideshow with crossfade transitions
    KenBurns.tsx          — Ken Burns zoom/pan effect
    TitleCard.tsx         — Animated title card with subtitle
    TransitionDemo.tsx    — Scene transitions (fade, slide, wipe, zoom)
  components/             — Reusable UI components
input/                    — Place source videos here
output/                   — Generated clips output here
public/                   — Static assets
```

## Pipeline Steps Explained

### Step 1: Transcribe (AssemblyAI)
- Uploads video to AssemblyAI
- Gets full transcript text + word-level timestamps
- Generates SRT caption file from word timestamps
- Outputs: `transcript.txt`, `transcript.srt`, `words.json`

### Step 2: Identify Clips (Claude)
- Sends transcript + SRT to Claude
- AI identifies the best 30-90 second segments for short-form content
- Scores each clip's "hook" strength (1-10)
- Outputs: `clips.json`

### Step 3: Extract SRT Timecodes
- Matches each clip's transcript to the full SRT file
- Extracts precise start/end timestamps
- Generates per-clip SRT with timestamps relative to clip start
- Outputs: `clip-N.srt`, `timecodes.json`

### Step 4: Cut Clips (ffmpeg)
- Cuts each clip from the source video at the exact timestamps
- Extracts a keyframe image from the middle of each clip
- Outputs: `clip-N-raw.mp4`, `clip-N-keyframe.jpg`

### Step 5: Detect Face (Claude Vision)
- Sends keyframe image to Claude Vision
- Gets X,Y coordinates of the speaker's face center
- Used to position the vertical crop centered on the speaker

### Step 6: Crop to Vertical (ffmpeg)
- Calculates crop area centered on face position
- Crops horizontal video to 9:16 aspect ratio
- Scales to target dimensions (default 1080x1920)
- Outputs: `clip-N-vertical.mp4`

### Step 7: Add Captions (ffmpeg + ASS)
- Converts clip SRT to ASS subtitle format with styling
- Burns styled captions directly into the video
- Uppercase text, outline, configurable position
- Outputs: `clip-N-final.mp4`

## Environment Variables
- `ASSEMBLYAI_API_KEY` — Required for transcription
- `ANTHROPIC_API_KEY` — Required for clip identification and face detection

## Prerequisites
- Node.js 18+
- ffmpeg (with libx264, libass support)
- ffprobe

## Remotion Studio
The project also includes Remotion compositions for visual editing:
```bash
npm run dev    # Opens Remotion Studio in browser
```

### Available Compositions
- **TextOverlay** — Animated text with spring entrance/exit
- **ImageSlideshow** — Crossfading image slideshow
- **KenBurns** — Cinematic zoom/pan effect
- **TitleCard** — Animated title + subtitle
- **TransitionDemo** — fade/slide/wipe/zoom transitions

### Remotion Core Concepts
- `useCurrentFrame()` — Current frame number (0-indexed)
- `useVideoConfig()` — Returns `{ width, height, fps, durationInFrames }`
- `interpolate(frame, inputRange, outputRange)` — Animate values
- `spring({ frame, fps, config })` — Physics-based animation
- `<AbsoluteFill>` — Full-canvas container
- `<Sequence from={frame}>` — Time-offset sections

### Remotion Documentation
Append `.md` to any remotion.dev URL for markdown:
- `https://remotion.dev/docs/interpolate.md`
- `https://remotion.dev/docs/spring.md`
- `https://remotion.dev/docs/sequence.md`
