import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
} from "remotion";
import { z } from "zod";

export const transitionDemoSchema = z.object({
  text1: z.string(),
  text2: z.string(),
  transitionType: z.enum(["fade", "slide", "wipe", "zoom"]),
  transitionDuration: z.number().min(5).max(60),
});

type TransitionDemoProps = z.infer<typeof transitionDemoSchema>;

export const TransitionDemo: React.FC<TransitionDemoProps> = ({
  text1,
  text2,
  transitionType,
  transitionDuration,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const midpoint = Math.floor(durationInFrames / 2);

  const progress = interpolate(
    frame,
    [midpoint - transitionDuration / 2, midpoint + transitionDuration / 2],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  const getScene1Style = (): React.CSSProperties => {
    switch (transitionType) {
      case "fade":
        return { opacity: 1 - progress };
      case "slide":
        return { transform: `translateX(${-progress * 100}%)` };
      case "wipe":
        return { clipPath: `inset(0 ${progress * 100}% 0 0)` };
      case "zoom":
      default:
        return {
          opacity: 1 - progress,
          transform: `scale(${1 + progress * 0.5})`,
        };
    }
  };

  const getScene2Style = (): React.CSSProperties => {
    switch (transitionType) {
      case "fade":
        return { opacity: progress };
      case "slide":
        return { transform: `translateX(${(1 - progress) * 100}%)` };
      case "wipe":
        return { clipPath: `inset(0 0 0 ${(1 - progress) * 100}%)` };
      case "zoom":
      default:
        return {
          opacity: progress,
          transform: `scale(${1.5 - progress * 0.5})`,
        };
    }
  };

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <AbsoluteFill
        style={{
          backgroundColor: "#1a1a2e",
          ...getScene1Style(),
        }}
        className="flex items-center justify-center"
      >
        <div
          style={{
            fontSize: 72,
            color: "#e94560",
            fontWeight: "bold",
            fontFamily: "Inter, sans-serif",
          }}
        >
          {text1}
        </div>
      </AbsoluteFill>
      <AbsoluteFill
        style={{
          backgroundColor: "#16213e",
          ...getScene2Style(),
        }}
        className="flex items-center justify-center"
      >
        <div
          style={{
            fontSize: 72,
            color: "#0f3460",
            fontWeight: "bold",
            fontFamily: "Inter, sans-serif",
          }}
        >
          {text2}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
