import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  Img,
  interpolate,
} from "remotion";
import { z } from "zod";

export const imageSlideshowSchema = z.object({
  images: z.array(z.string()),
  transitionDuration: z.number().min(1).max(60),
});

type ImageSlideshowProps = z.infer<typeof imageSlideshowSchema>;

export const ImageSlideshow: React.FC<ImageSlideshowProps> = ({
  images,
  transitionDuration,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  const framesPerImage = Math.floor(durationInFrames / images.length);

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {images.map((imageUrl, index) => {
        const startFrame = index * framesPerImage;
        const endFrame = startFrame + framesPerImage;

        const opacity = interpolate(
          frame,
          [
            startFrame,
            startFrame + transitionDuration,
            endFrame - transitionDuration,
            endFrame,
          ],
          [0, 1, 1, 0],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
        );

        const scale = interpolate(
          frame,
          [startFrame, endFrame],
          [1, 1.1],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
        );

        return (
          <AbsoluteFill key={index} style={{ opacity }}>
            <Img
              src={imageUrl}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                transform: `scale(${scale})`,
              }}
            />
          </AbsoluteFill>
        );
      })}
    </AbsoluteFill>
  );
};
