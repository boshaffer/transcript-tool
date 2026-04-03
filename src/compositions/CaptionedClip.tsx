import React, { useMemo } from "react";
import {
  AbsoluteFill,
  OffthreadVideo,
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
  staticFile,
} from "remotion";
import { z } from "zod";

const wordSchema = z.object({
  text: z.string(),
  start: z.number(),
  end: z.number(),
});

export const captionedClipSchema = z.object({
  videoSrc: z.string(),
  words: z.array(wordSchema),
  highlightColor: z.string().default("#FFD700"),
  textColor: z.string().default("#FFFFFF"),
  fontSize: z.number().default(68),
  position: z.enum(["bottom", "center", "top"]).default("bottom"),
  wordsPerGroup: z.number().default(4),
  fontFamily: z.string().default("Inter, Arial, sans-serif"),
});

export type CaptionedClipProps = z.infer<typeof captionedClipSchema>;

interface WordGroup {
  words: Array<{ text: string; start: number; end: number }>;
  startMs: number;
  endMs: number;
}

function groupWords(
  words: Array<{ text: string; start: number; end: number }>,
  wordsPerGroup: number
): WordGroup[] {
  const groups: WordGroup[] = [];
  for (let i = 0; i < words.length; i += wordsPerGroup) {
    const chunk = words.slice(i, i + wordsPerGroup);
    groups.push({
      words: chunk,
      startMs: chunk[0].start,
      endMs: chunk[chunk.length - 1].end,
    });
  }
  return groups;
}

// Lookahead in ms — highlight the word slightly before it's spoken
// so the visual feels in-sync with audio (human perception compensated)
const HIGHLIGHT_LOOKAHEAD_MS = 150;

export const CaptionedClip: React.FC<CaptionedClipProps> = ({
  videoSrc,
  words,
  highlightColor,
  textColor,
  fontSize,
  position,
  wordsPerGroup,
  fontFamily,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const resolvedVideoSrc = useMemo(() => {
    if (
      videoSrc.startsWith("http://") ||
      videoSrc.startsWith("https://") ||
      videoSrc.startsWith("file://")
    ) {
      return videoSrc;
    }
    return staticFile(videoSrc);
  }, [videoSrc]);

  const currentTimeMs = (frame / fps) * 1000;
  // Apply lookahead: treat current time as slightly ahead for highlight matching
  const highlightTimeMs = currentTimeMs + HIGHLIGHT_LOOKAHEAD_MS;

  const groups = useMemo(() => groupWords(words, wordsPerGroup), [words, wordsPerGroup]);

  // Find the current group (use lookahead time for group matching too)
  const currentGroup = groups.find(
    (g) => highlightTimeMs >= g.startMs && currentTimeMs <= g.endMs
  );

  // Position styles
  const positionStyle: React.CSSProperties =
    position === "top"
      ? { top: 80 }
      : position === "center"
        ? { top: "50%", transform: "translateY(-50%)" }
        : { bottom: 120 };

  // Group entrance animation
  const groupAppearFrame = currentGroup
    ? (currentGroup.startMs / 1000) * fps
    : 0;
  const groupSpring = currentGroup
    ? spring({
        frame: frame - groupAppearFrame,
        fps,
        config: { damping: 15, stiffness: 200 },
      })
    : 0;

  return (
    <AbsoluteFill>
      <OffthreadVideo src={resolvedVideoSrc} />
      <AbsoluteFill>
        {currentGroup && (
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              ...positionStyle,
              display: "flex",
              justifyContent: "center",
              padding: "0 40px",
              opacity: groupSpring,
              transform:
                position === "center"
                  ? `translateY(calc(-50% + ${interpolate(groupSpring, [0, 1], [20, 0])}px))`
                  : `translateY(${interpolate(groupSpring, [0, 1], [20, 0])}px)`,
            }}
          >
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                justifyContent: "center",
                gap: "10px 16px",
                maxWidth: "90%",
              }}
            >
              {currentGroup.words.map((word, idx) => {
                const isActive =
                  highlightTimeMs >= word.start && highlightTimeMs <= word.end;
                const isPast = highlightTimeMs > word.end;

                // Spring for individual word highlight
                const wordFrame = (word.start / 1000) * fps;
                const wordSpring = spring({
                  frame: frame - wordFrame,
                  fps,
                  config: { damping: 12, stiffness: 300 },
                });

                const scale = isActive
                  ? interpolate(wordSpring, [0, 1], [1, 1.12])
                  : 1;

                return (
                  <span
                    key={`${word.start}-${idx}`}
                    style={{
                      fontSize,
                      fontFamily,
                      fontWeight: 800,
                      color: isActive ? highlightColor : textColor,
                      opacity: isPast ? 0.7 : 1,
                      textTransform: "uppercase",
                      textShadow: isActive
                        ? `0 2px 12px rgba(0,0,0,0.9), 0 0 30px rgba(0,0,0,0.6)`
                        : `0 2px 8px rgba(0,0,0,0.8), 0 0 20px rgba(0,0,0,0.5)`,
                      WebkitTextStroke: "1.5px rgba(0,0,0,0.4)",
                      transform: `scale(${scale})`,
                      display: "inline-block",
                      lineHeight: 1.4,
                      letterSpacing: "0.02em",
                    }}
                  >
                    {word.text.toUpperCase()}
                  </span>
                );
              })}
            </div>
          </div>
        )}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
