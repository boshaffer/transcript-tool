import { execSync } from "child_process";
import fs from "fs";
import path from "path";

interface TranscriptWord {
  text: string;
  start: number;
  end: number;
}

interface TranscriptResult {
  text: string;
  words: TranscriptWord[];
  srt: string;
}

interface WhisperSegment {
  text: string;
  timestamps: { from: string; to: string };
  offsets: { from: number; to: number };
}

interface WhisperJson {
  transcription: WhisperSegment[];
}

function findWhisperBinary(): string {
  const candidates = [
    "whisper-cli",
    "whisper",
    "main",
  ];

  if (process.env.WHISPER_CPP_PATH) {
    const custom = process.env.WHISPER_CPP_PATH;
    if (fs.existsSync(custom)) return custom;
  }

  // Check common build paths
  const buildPaths = [
    "/home/user/whisper.cpp/build/bin/whisper-cli",
    path.resolve("./whisper.cpp/build/bin/whisper-cli"),
  ];
  for (const p of buildPaths) {
    if (fs.existsSync(p)) return p;
  }

  for (const name of candidates) {
    try {
      execSync(`which ${name}`, { stdio: "pipe" });
      return name;
    } catch {
      // not found
    }
  }

  throw new Error(
    `whisper.cpp binary not found. Install it:\n` +
      `  git clone https://github.com/ggerganov/whisper.cpp && cd whisper.cpp && make\n` +
      `  bash models/download-ggml-model.sh base\n` +
      `Or set WHISPER_CPP_PATH to the binary location.`
  );
}

function findWhisperModel(): string {
  if (process.env.WHISPER_MODEL_PATH) {
    const custom = process.env.WHISPER_MODEL_PATH;
    if (fs.existsSync(custom)) return custom;
  }

  const homeDir = process.env.HOME || process.env.USERPROFILE || "";
  const candidates = [
    "/home/user/whisper.cpp/models/ggml-base.bin",
    path.join(homeDir, ".local/share/whisper.cpp/ggml-base.bin"),
    path.join(homeDir, ".cache/whisper/ggml-base.bin"),
    path.join(homeDir, "whisper.cpp/models/ggml-base.bin"),
    "./models/ggml-base.bin",
    "./whisper.cpp/models/ggml-base.bin",
    path.join(homeDir, ".local/share/whisper.cpp/ggml-small.bin"),
    path.join(homeDir, "whisper.cpp/models/ggml-small.bin"),
    "./models/ggml-small.bin",
  ];

  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }

  throw new Error(
    `Whisper model not found. Download one:\n` +
      `  cd whisper.cpp && bash models/download-ggml-model.sh base\n` +
      `Or set WHISPER_MODEL_PATH to the .bin file location.`
  );
}

function extractAudioAsWav(videoPath: string, outputDir: string): string {
  const wavPath = path.join(outputDir, "audio.wav");
  console.log("  Extracting audio to 16kHz WAV...");
  execSync(
    `ffmpeg -y -i "${videoPath}" -ar 16000 -ac 1 -c:a pcm_s16le "${wavPath}"`,
    { stdio: "pipe" }
  );
  return wavPath;
}

/**
 * Parse whisper JSON output (--max-len 1 --split-on-word mode).
 * Each segment is a single word with its own timestamp.
 * Handles collapsed timestamps by interpolating between known good timestamps.
 */
function parseWhisperWordJson(jsonPath: string): {
  text: string;
  words: TranscriptWord[];
} {
  const raw = fs.readFileSync(jsonPath, "utf-8");
  const data: WhisperJson = JSON.parse(raw);

  const rawWords: TranscriptWord[] = [];
  const textParts: string[] = [];

  for (const seg of data.transcription) {
    let text = seg.text.trim();
    if (!text) continue;

    // Strip punctuation from the word for the caption
    const cleanText = text.replace(/[.,!?;:]+$/g, "");
    if (!cleanText) continue;

    textParts.push(text);
    rawWords.push({
      text: cleanText,
      start: seg.offsets.from,
      end: seg.offsets.to,
    });
  }

  // Fix collapsed timestamps: when multiple consecutive words share
  // the same start/end, interpolate them across the available range
  const words = fixCollapsedTimestamps(rawWords);

  return { text: textParts.join(" "), words };
}

/**
 * When whisper collapses timestamps at segment boundaries (multiple words
 * all showing e.g. 7000ms-7000ms), interpolate them between the last
 * known good timestamp and the next known good start time.
 * Steals time from the preceding word to give collapsed words room.
 */
function fixCollapsedTimestamps(words: TranscriptWord[]): TranscriptWord[] {
  const result = words.map((w) => ({ ...w }));

  let i = 0;
  while (i < result.length) {
    if (result[i].start === result[i].end) {
      const runStart = i;
      const collapsedTime = result[i].start;
      while (
        i < result.length &&
        result[i].start === collapsedTime &&
        result[i].end === collapsedTime
      ) {
        i++;
      }
      const runEnd = i;
      const runLength = runEnd - runStart;

      // Start of interpolation range: steal 2/3 of previous word's duration
      let rangeStart = collapsedTime;
      if (runStart > 0) {
        const prev = result[runStart - 1];
        const prevDuration = prev.end - prev.start;
        rangeStart = prev.start + Math.floor(prevDuration / 3);
        result[runStart - 1].end = rangeStart - 10;
      }

      // End of interpolation range: next word's start, or estimate
      let rangeEnd = collapsedTime + runLength * 300;
      if (runEnd < result.length) {
        rangeEnd = result[runEnd].start;
      }

      const totalDuration = rangeEnd - rangeStart;
      const perWord = totalDuration / runLength;

      for (let j = 0; j < runLength; j++) {
        result[runStart + j].start = Math.round(rangeStart + j * perWord);
        result[runStart + j].end = Math.round(
          rangeStart + (j + 1) * perWord - 20
        );
      }
    } else {
      i++;
    }
  }

  return result;
}

function wordsToSrt(words: TranscriptWord[]): string {
  const lines: string[] = [];
  let index = 1;
  const chunkSize = 8;

  for (let i = 0; i < words.length; i += chunkSize) {
    const chunk = words.slice(i, i + chunkSize);
    const start = chunk[0].start;
    const end = chunk[chunk.length - 1].end;
    const text = chunk.map((w) => w.text).join(" ");

    lines.push(String(index));
    lines.push(`${formatSrtTime(start)} --> ${formatSrtTime(end)}`);
    lines.push(text);
    lines.push("");
    index++;
  }

  return lines.join("\n");
}

function formatSrtTime(ms: number): string {
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  const millis = ms % 1000;
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)},${pad3(millis)}`;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function pad3(n: number): string {
  return String(n).padStart(3, "0");
}

export async function transcribeVideo(
  videoPath: string,
  outputDir: string,
  model?: string
): Promise<TranscriptResult> {
  const whisperBin = findWhisperBinary();
  const whisperModel = model || findWhisperModel();

  console.log(`  Using whisper.cpp: ${whisperBin}`);
  console.log(`  Model: ${whisperModel}`);

  // Step 1: Extract audio as 16kHz WAV
  console.log("[1/3] Extracting audio from video...");
  const wavPath = extractAudioAsWav(videoPath, outputDir);

  // Step 2: Run whisper.cpp with per-word segments for accurate timestamps
  console.log("[2/3] Transcribing with whisper.cpp (this may take a while)...");
  const jsonOutputBase = path.join(outputDir, "whisper-output");

  execSync(
    `"${whisperBin}" -m "${whisperModel}" -f "${wavPath}" --output-json --max-len 1 --split-on-word -of "${jsonOutputBase}" --print-progress`,
    { stdio: "inherit", timeout: 600000 }
  );

  // Step 3: Parse results
  console.log("[3/3] Parsing transcription results...");
  const jsonPath = `${jsonOutputBase}.json`;

  if (!fs.existsSync(jsonPath)) {
    throw new Error(
      `Whisper output not found at ${jsonPath}. Check whisper.cpp installation.`
    );
  }

  const { text, words } = parseWhisperWordJson(jsonPath);
  const srt = wordsToSrt(words);

  // Save outputs
  const transcriptPath = path.join(outputDir, "transcript.txt");
  const srtPath = path.join(outputDir, "transcript.srt");
  const wordsPath = path.join(outputDir, "words.json");

  fs.writeFileSync(transcriptPath, text);
  fs.writeFileSync(srtPath, srt);
  fs.writeFileSync(wordsPath, JSON.stringify(words, null, 2));

  console.log(`  Transcript: ${words.length} words`);
  console.log("  Saved to:", transcriptPath);

  // Clean up WAV file
  fs.unlinkSync(wavPath);

  return { text, words, srt };
}
