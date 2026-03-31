import fs from "fs";
import path from "path";

interface SrtEntry {
  index: number;
  startMs: number;
  endMs: number;
  startTime: string;
  endTime: string;
  text: string;
}

interface ClipTimecodes {
  clipNumber: number;
  title: string;
  startMs: number;
  endMs: number;
  startTime: string;
  endTime: string;
  durationMs: number;
  srt: string;
  transcript: string;
}

function parseSrt(srtContent: string): SrtEntry[] {
  const entries: SrtEntry[] = [];
  const blocks = srtContent.trim().split(/\n\n+/);

  for (const block of blocks) {
    const lines = block.trim().split("\n");
    if (lines.length < 3) continue;

    const index = parseInt(lines[0], 10);
    const timeParts = lines[1].split(" --> ");
    if (timeParts.length !== 2) continue;

    const startTime = timeParts[0].trim();
    const endTime = timeParts[1].trim();
    const text = lines.slice(2).join(" ");

    entries.push({
      index,
      startMs: srtTimeToMs(startTime),
      endMs: srtTimeToMs(endTime),
      startTime,
      endTime,
      text,
    });
  }

  return entries;
}

function srtTimeToMs(time: string): number {
  const [hms, ms] = time.split(",");
  const [h, m, s] = hms.split(":").map(Number);
  return h * 3600000 + m * 60000 + s * 1000 + parseInt(ms, 10);
}

function msToSrtTime(ms: number): string {
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  const millis = ms % 1000;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")},${String(millis).padStart(3, "0")}`;
}

function findClipInSrt(
  srtEntries: SrtEntry[],
  clipTranscript: string
): { startMs: number; endMs: number; matchedEntries: SrtEntry[] } {
  const clipWords = clipTranscript.toLowerCase().replace(/[^\w\s]/g, "").split(/\s+/);
  const firstWords = clipWords.slice(0, 5).join(" ");
  const lastWords = clipWords.slice(-5).join(" ");

  let bestStartIdx = -1;
  let bestEndIdx = -1;
  let bestScore = 0;

  // Find the best matching range of SRT entries
  for (let i = 0; i < srtEntries.length; i++) {
    const entryWords = srtEntries[i].text.toLowerCase().replace(/[^\w\s]/g, "");
    if (entryWords.includes(firstWords.slice(0, 20)) || firstWords.includes(entryWords.slice(0, 20))) {
      // Found potential start, now find end
      for (let j = i + 1; j < Math.min(i + 50, srtEntries.length); j++) {
        const endWords = srtEntries[j].text.toLowerCase().replace(/[^\w\s]/g, "");
        if (endWords.includes(lastWords.slice(-20)) || lastWords.includes(endWords.slice(-20))) {
          const rangeText = srtEntries
            .slice(i, j + 1)
            .map((e) => e.text)
            .join(" ")
            .toLowerCase();
          const matchCount = clipWords.filter((w) =>
            rangeText.includes(w)
          ).length;
          const score = matchCount / clipWords.length;

          if (score > bestScore) {
            bestScore = score;
            bestStartIdx = i;
            bestEndIdx = j;
          }
        }
      }
    }
  }

  // Fallback: scan through all entries and find the best contiguous match
  if (bestStartIdx === -1) {
    for (let i = 0; i < srtEntries.length; i++) {
      for (
        let j = i + 2;
        j < Math.min(i + 50, srtEntries.length);
        j++
      ) {
        const rangeText = srtEntries
          .slice(i, j + 1)
          .map((e) => e.text)
          .join(" ")
          .toLowerCase();
        const matchCount = clipWords.filter((w) =>
          rangeText.includes(w)
        ).length;
        const score = matchCount / clipWords.length;

        if (score > bestScore) {
          bestScore = score;
          bestStartIdx = i;
          bestEndIdx = j;
        }
      }
    }
  }

  if (bestStartIdx === -1 || bestEndIdx === -1) {
    throw new Error("Could not find clip transcript in SRT file");
  }

  const matchedEntries = srtEntries.slice(bestStartIdx, bestEndIdx + 1);
  return {
    startMs: matchedEntries[0].startMs,
    endMs: matchedEntries[matchedEntries.length - 1].endMs,
    matchedEntries,
  };
}

export async function extractClipTimecodes(
  clips: Array<{ clipNumber: number; title: string; transcript: string }>,
  srtContent: string,
  outputDir: string
): Promise<ClipTimecodes[]> {
  console.log("[SRT Extract] Matching clips to SRT timestamps...");

  const srtEntries = parseSrt(srtContent);
  const results: ClipTimecodes[] = [];

  for (const clip of clips) {
    try {
      const { startMs, endMs, matchedEntries } = findClipInSrt(
        srtEntries,
        clip.transcript
      );

      // Build clip-specific SRT with timestamps relative to clip start
      const clipSrtLines: string[] = [];
      matchedEntries.forEach((entry, idx) => {
        const relStart = entry.startMs - startMs;
        const relEnd = entry.endMs - startMs;
        clipSrtLines.push(String(idx + 1));
        clipSrtLines.push(
          `${msToSrtTime(relStart)} --> ${msToSrtTime(relEnd)}`
        );
        clipSrtLines.push(entry.text);
        clipSrtLines.push("");
      });

      const result: ClipTimecodes = {
        clipNumber: clip.clipNumber,
        title: clip.title,
        startMs,
        endMs,
        startTime: msToSrtTime(startMs),
        endTime: msToSrtTime(endMs),
        durationMs: endMs - startMs,
        srt: clipSrtLines.join("\n"),
        transcript: matchedEntries.map((e) => e.text).join(" "),
      };

      results.push(result);

      // Save individual clip SRT
      const clipSrtPath = path.join(
        outputDir,
        `clip-${clip.clipNumber}.srt`
      );
      fs.writeFileSync(clipSrtPath, result.srt);

      console.log(
        `  Clip ${clip.clipNumber}: ${result.startTime} -> ${result.endTime} (${(result.durationMs / 1000).toFixed(1)}s)`
      );
    } catch (e) {
      console.error(
        `  Warning: Could not match clip ${clip.clipNumber}: ${e}`
      );
    }
  }

  // Save all timecodes
  const timecodesPath = path.join(outputDir, "timecodes.json");
  fs.writeFileSync(timecodesPath, JSON.stringify(results, null, 2));

  return results;
}

/**
 * Extract per-clip word arrays from the full words.json,
 * with timestamps adjusted to be relative to each clip's start.
 */
export function extractClipWords(
  allWords: Array<{ text: string; start: number; end: number }>,
  timecodes: ClipTimecodes[]
): Map<number, Array<{ text: string; start: number; end: number }>> {
  const result = new Map<
    number,
    Array<{ text: string; start: number; end: number }>
  >();

  for (const tc of timecodes) {
    // Find words that fall within this clip's time range
    const clipWords = allWords
      .filter((w) => w.start >= tc.startMs && w.end <= tc.endMs)
      .map((w) => ({
        text: w.text,
        start: w.start - tc.startMs,
        end: w.end - tc.startMs,
      }));

    result.set(tc.clipNumber, clipWords);

    console.log(
      `  Clip ${tc.clipNumber}: ${clipWords.length} words extracted`
    );
  }

  return result;
}
