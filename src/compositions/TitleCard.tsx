import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from "remotion";
import { z } from "zod";

export const titleCardSchema = z.object({
  title: z.string(),
  subtitle: z.string(),
  backgroundColor: z.string(),
  titleColor: z.string(),
  subtitleColor: z.string(),
});

type TitleCardProps = z.infer<typeof titleCardSchema>;

export const TitleCard: React.FC<TitleCardProps> = ({
  title,
  subtitle,
  backgroundColor,
  titleColor,
  subtitleColor,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const titleSpring = spring({
    frame,
    fps,
    config: { damping: 15, stiffness: 150 },
  });

  const subtitleSpring = spring({
    frame: frame - 10,
    fps,
    config: { damping: 15, stiffness: 150 },
  });

  const fadeOut = interpolate(
    frame,
    [durationInFrames - 20, durationInFrames],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  const lineWidth = interpolate(titleSpring, [0, 1], [0, 200]);

  return (
    <AbsoluteFill
      style={{ backgroundColor }}
      className="flex flex-col items-center justify-center"
    >
      <div style={{ opacity: fadeOut, textAlign: "center" }}>
        <h1
          style={{
            fontSize: 90,
            fontWeight: "bold",
            color: titleColor,
            fontFamily: "Inter, sans-serif",
            transform: `translateY(${interpolate(titleSpring, [0, 1], [40, 0])}px)`,
            opacity: titleSpring,
            marginBottom: 20,
          }}
        >
          {title}
        </h1>
        <div
          style={{
            width: lineWidth,
            height: 4,
            backgroundColor: titleColor,
            margin: "0 auto 20px",
            borderRadius: 2,
          }}
        />
        <p
          style={{
            fontSize: 36,
            color: subtitleColor,
            fontFamily: "Inter, sans-serif",
            transform: `translateY(${interpolate(subtitleSpring, [0, 1], [30, 0])}px)`,
            opacity: subtitleSpring,
            fontWeight: 300,
          }}
        >
          {subtitle}
        </p>
      </div>
    </AbsoluteFill>
  );
};
