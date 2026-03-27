# Remotion Video Editor - Claude Code Guide

## Project Overview
This is a Remotion-based video editing project. Remotion lets you create videos programmatically using React components.

## Key Commands
- `npm run dev` — Start the Remotion Studio (visual editor in browser)
- `npm run render` — Render video to file (outputs to `out/` directory)
- `npx remotion render src/index.ts <CompositionId> out/video.mp4` — Render a specific composition
- `npx remotion still src/index.ts <CompositionId> out/still.png` — Render a single frame as image

## Project Structure
```
src/
  index.ts          — Entry point, registers the root component
  Root.tsx           — Registers all compositions with their metadata
  styles.css         — TailwindCSS v4 styles
  compositions/      — Video compositions (scenes)
    TextOverlay.tsx   — Animated text on colored background
    ImageSlideshow.tsx — Slideshow with crossfade transitions
    KenBurns.tsx      — Ken Burns zoom/pan effect on images
    TitleCard.tsx     — Animated title card with subtitle
    TransitionDemo.tsx — Scene transitions (fade, slide, wipe, zoom)
  components/        — Reusable UI components
public/              — Static assets (images, fonts, audio)
remotion.config.ts   — Remotion + TailwindCSS configuration
```

## Core Concepts

### Compositions
Each video is a `<Composition>` registered in `Root.tsx` with:
- `id` — Unique identifier used for rendering
- `component` — React component that renders the video
- `durationInFrames` — Total frames (frames = seconds × fps)
- `fps` — Frames per second (typically 30)
- `width` / `height` — Video dimensions in pixels
- `schema` — Zod schema for props validation
- `defaultProps` — Default prop values

### Hooks
- `useCurrentFrame()` — Returns the current frame number (0-indexed)
- `useVideoConfig()` — Returns `{ width, height, fps, durationInFrames }`

### Animation Utilities
- `interpolate(frame, inputRange, outputRange, options)` — Map frame numbers to animated values
- `spring({ frame, fps, config })` — Physics-based spring animation
- `<Sequence from={frame} durationInFrames={n}>` — Time-offset a section
- `<AbsoluteFill>` — Full-canvas positioned container

### Media
- `<Img src={url} />` — Display images (use Remotion's Img, not HTML img)
- `<Video src={url} />` — Embed video clips
- `<Audio src={url} />` — Add audio tracks
- `<OffthreadVideo src={url} />` — Memory-efficient video embedding

## How to Create a New Composition

1. Create a new file in `src/compositions/MyScene.tsx`:
```tsx
import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { z } from "zod";

export const mySceneSchema = z.object({
  title: z.string(),
});

export const MyScene: React.FC<z.infer<typeof mySceneSchema>> = ({ title }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  const opacity = interpolate(frame, [0, 30], [0, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill className="flex items-center justify-center bg-black">
      <h1 style={{ color: "white", fontSize: 80, opacity }}>{title}</h1>
    </AbsoluteFill>
  );
};
```

2. Register it in `src/Root.tsx`:
```tsx
import { MyScene, mySceneSchema } from "./compositions/MyScene";

// Add inside the RemotionRoot fragment:
<Composition
  id="MyScene"
  component={MyScene}
  durationInFrames={150}
  fps={30}
  width={1920}
  height={1080}
  schema={mySceneSchema}
  defaultProps={{ title: "Hello" }}
/>
```

3. Render it:
```bash
npx remotion render src/index.ts MyScene out/my-scene.mp4
```

## Available Compositions
- **TextOverlay** — Animated text with spring entrance/exit
- **ImageSlideshow** — Crossfading image slideshow with subtle zoom
- **KenBurns** — Cinematic zoom/pan effect on a single image
- **TitleCard** — Animated title + subtitle with divider line
- **TransitionDemo** — Demonstrates fade/slide/wipe/zoom transitions

## Tips for Editing
- Frame 0 is the first frame; last frame is `durationInFrames - 1`
- Use `interpolate()` with `extrapolateLeft: "clamp"` and `extrapolateRight: "clamp"` to prevent values from exceeding the output range
- TailwindCSS classes work in all components (via `className`)
- Place static assets in `public/` and reference them with `staticFile("filename.png")`
- Use `spring()` for natural-feeling animations
- Props with Zod schemas enable type-safe editing in Remotion Studio

## Remotion Documentation
For detailed API docs, append `.md` to any remotion.dev URL:
- `https://remotion.dev/docs/interpolate.md`
- `https://remotion.dev/docs/spring.md`
- `https://remotion.dev/docs/sequence.md`
