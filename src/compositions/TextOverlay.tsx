import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from "remotion";
import { z } from "zod";

export const textOverlaySchema = z.object({
  text: z.string(),
  fontSize: z.number().min(10).max(300),
  color: z.string(),
  backgroundColor: z.string(),
  fontFamily: z.string(),
});

type TextOverlayProps = z.infer<typeof textOverlaySchema>;

export const TextOverlay: React.FC<TextOverlayProps> = ({
  text,
  fontSize,
  color,
  backgroundColor,
  fontFamily,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const enterAnimation = spring({
    frame,
    fps,
    config: { damping: 12, stiffness: 200 },
  });

  const exitAnimation = spring({
    frame: frame - (durationInFrames - 30),
    fps,
    config: { damping: 12, stiffness: 200 },
  });

  const opacity = interpolate(
    frame,
    [0, 15, durationInFrames - 30, durationInFrames],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  const scale = enterAnimation - (frame > durationInFrames - 30 ? exitAnimation : 0);
  const translateY = interpolate(enterAnimation, [0, 1], [50, 0]);

  return (
    <AbsoluteFill
      style={{ backgroundColor }}
      className="flex items-center justify-center"
    >
      <div
        style={{
          fontSize,
          color,
          fontFamily,
          opacity,
          transform: `scale(${scale}) translateY(${translateY}px)`,
          textAlign: "center",
          padding: "0 60px",
          fontWeight: "bold",
          lineHeight: 1.2,
        }}
      >
        {text}
      </div>
    </AbsoluteFill>
  );
};
