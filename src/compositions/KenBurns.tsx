import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  Img,
  interpolate,
} from "remotion";
import { z } from "zod";

export const kenBurnsSchema = z.object({
  imageUrl: z.string(),
  zoomStart: z.number().min(0.5).max(3),
  zoomEnd: z.number().min(0.5).max(3),
  direction: z.enum(["in", "out"]),
});

type KenBurnsProps = z.infer<typeof kenBurnsSchema>;

export const KenBurns: React.FC<KenBurnsProps> = ({
  imageUrl,
  zoomStart,
  zoomEnd,
  direction,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  const start = direction === "in" ? zoomStart : zoomEnd;
  const end = direction === "in" ? zoomEnd : zoomStart;

  const scale = interpolate(frame, [0, durationInFrames], [start, end], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const translateX = interpolate(frame, [0, durationInFrames], [0, -20], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const translateY = interpolate(frame, [0, durationInFrames], [0, -10], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ backgroundColor: "#000", overflow: "hidden" }}>
      <Img
        src={imageUrl}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          transform: `scale(${scale}) translate(${translateX}px, ${translateY}px)`,
        }}
      />
    </AbsoluteFill>
  );
};
