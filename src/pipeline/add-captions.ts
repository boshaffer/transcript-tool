import { execSync } from "child_process";
import fs from "fs";
import path from "path";

interface CaptionStyle {
  fontFamily: string;
  fontSize: number;
  primaryColor: string;
  outlineColor: string;
  outlineWidth: number;
  position: "bottom" | "center" | "top";
  bold: boolean;
}

const DEFAULT_STYLE: CaptionStyle = {
  fontFamily: "Arial",
  fontSize: 22,
  primaryColor: "#FFFFFF",
  outlineColor: "#000000",
  outlineWidth: 3,
  position: "bottom",
  bold: true,
};

function hexToAss(hex: string): string {
  // ASS uses &HBBGGRR& format
  const r = hex.slice(1, 3);
  const g = hex.slice(3, 5);
  const b = hex.slice(5, 7);
  return `&H00${b}${g}${r}&`;
}

function srtToAss(
  srtContent: string,
  style: CaptionStyle,
  videoWidth: number,
  videoHeight: number
): string {
  const marginV =
    style.position === "bottom"
      ? 80
      : style.position === "top"
        ? videoHeight - 200
        : Math.round(videoHeight / 2) - 50;

  const alignment =
    style.position === "bottom" ? 2 : style.position === "top" ? 8 : 5;

  const header = `[Script Info]
ScriptType: v4.00+
PlayResX: ${videoWidth}
PlayResY: ${videoHeight}
WrapStyle: 0

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,${style.fontFamily},${style.fontSize},${hexToAss(style.primaryColor)},${hexToAss(style.primaryColor)},${hexToAss(style.outlineColor)},&H80000000&,${style.bold ? -1 : 0},0,0,0,100,100,0,0,1,${style.outlineWidth},1,${alignment},20,20,${marginV},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  const entries = parseSrtForAss(srtContent);
  const events = entries
    .map((e) => {
      const text = e.text
        .replace(/\n/g, "\\N")
        .toUpperCase();
      return `Dialogue: 0,${e.start},${e.end},Default,,0,0,0,,${text}`;
    })
    .join("\n");

  return header + events + "\n";
}

function parseSrtForAss(
  srt: string
): Array<{ start: string; end: string; text: string }> {
  const blocks = srt.trim().split(/\n\n+/);
  const entries: Array<{ start: string; end: string; text: string }> = [];

  for (const block of blocks) {
    const lines = block.trim().split("\n");
    if (lines.length < 3) continue;

    const timeParts = lines[1].split(" --> ");
    if (timeParts.length !== 2) continue;

    entries.push({
      start: srtTimeToAssTime(timeParts[0].trim()),
      end: srtTimeToAssTime(timeParts[1].trim()),
      text: lines.slice(2).join("\n"),
    });
  }

  return entries;
}

function srtTimeToAssTime(srtTime: string): string {
  // SRT: HH:MM:SS,mmm -> ASS: H:MM:SS.mm
  return srtTime
    .replace(",", ".")
    .replace(/^0(\d)/, "$1")
    .replace(/\.(\d{2})\d$/, ".$1");
}

export async function addCaptions(
  videoPath: string,
  srtContent: string,
  outputPath: string,
  videoWidth: number = 1080,
  videoHeight: number = 1920,
  style: Partial<CaptionStyle> = {}
): Promise<string> {
  const fullStyle = { ...DEFAULT_STYLE, ...style };
  const dir = path.dirname(outputPath);

  // Convert SRT to ASS for better styling control
  const assContent = srtToAss(srtContent, fullStyle, videoWidth, videoHeight);
  const assPath = path.join(dir, `temp-${Date.now()}.ass`);
  fs.writeFileSync(assPath, assContent);

  try {
    console.log("  Burning captions into video...");
    execSync(
      `ffmpeg -y -i "${videoPath}" -vf "ass=${assPath}" -c:v libx264 -c:a aac "${outputPath}"`,
      { stdio: "pipe" }
    );
    console.log("  Captioned video saved:", outputPath);
  } finally {
    // Cleanup temp ASS file
    if (fs.existsSync(assPath)) fs.unlinkSync(assPath);
  }

  return outputPath;
}
