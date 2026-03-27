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

interface WhisperToken {
  text: string;
  timestamps: { from: string; to: string };
  offsets: { from: number; to: number };
}

interface WhisperSegment {
  text: string;
  timestamps: { from: string; to: string };
  offsets: { from: number; to: number };
  tokens: WhisperToken[];
}

interface WhisperJson {
  transcription: WhisperSegment[];
}

function findWhisperBinary(): string {
  // Check common locations for whisper.cpp binary
  const candidates = [
    "whisper-cli",        // if installed via package manager
    "whisper",            // alias
    "main",              // default build name from whisper.cpp
  ];

  // Check WHISPER_CPP_PATH env var first
  if (process.env.WHISPER_CPP_PATH) {
    const custom = process.env.WHISPER_CPP_PATH;
    if (fs.existsSync(custom)) return custom;
  }

  for (const name of candidates) {
    try {
      execSync(`which ${name}`, { stdio: "pipe" });
      return name;
    } catch {
      // not found, try next
    }
  }

  throw new Error(
    `whisper.cpp binary not found. Install it:\n` +
      `  git clone https://github.com/ggerganov/whisper.cpp && cd whisper.cpp && make\n` +
      `  # Download a model:\n` +
      `  bash models/download-ggml-model.sh base\n` +
      `Or set WHISPER_CPP_PATH to the binary location.`
  );
}

function findWhisperModel(): string {
  // Check WHISPER_MODEL_PATH env var first
  if (process.env.WHISPER_MODEL_PATH) {
    const custom = process.env.WHISPER_MODEL_PATH;
    if (fs.existsSync(custom)) return custom;
  }

  // Check common locations
  const homeDir = process.env.HOME || process.env.USERPROFILE || "";
  const candidates = [
    path.join(homeDir, ".local/share/whisper.cpp/ggml-base.bin"),
    path.join(homeDir, ".cache/whisper/ggml-base.bin"),
    path.join(homeDir, "whisper.cpp/models/ggml-base.bin"),
    "./models/ggml-base.bin",
    "./whisper.cpp/models/ggml-base.bin",
    // Also check for other model sizes
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

function parseWhisperJson(jsonPath: string): {
  text: string;
  words: TranscriptWord[];
} {
  const raw = fs.readFileSync(jsonPath, "utf-8");
  const data: WhisperJson = JSON.parse(raw);

  const allWords: TranscriptWord[] = [];
  const textParts: string[] = [];

  for (const segment of data.transcription) {
    textParts.push(segment.text.trim());

    if (segment.tokens) {
      for (const token of segment.tokens) {
        const text = token.text.trim();
        if (!text) continue;
        allWords.push({
          text,
          start: token.offsets.from,
          end: token.offsets.to,
        });
      }
    }
  }

  return { text: textParts.join(" "), words: allWords };
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

  // Step 2: Run whisper.cpp with JSON output for word-level timestamps
  console.log("[2/3] Transcribing with whisper.cpp (this may take a while)...");
  const jsonOutputBase = path.join(outputDir, "whisper-output");

  execSync(
    `"${whisperBin}" -m "${whisperModel}" -f "${wavPath}" --output-json -of "${jsonOutputBase}" --print-progress`,
    { stdio: "inherit", timeout: 600000 } // 10 min timeout
  );

  // Step 3: Parse results
  console.log("[3/3] Parsing transcription results...");
  const jsonPath = `${jsonOutputBase}.json`;

  if (!fs.existsSync(jsonPath)) {
    throw new Error(
      `Whisper output not found at ${jsonPath}. Check whisper.cpp installation.`
    );
  }

  const { text, words } = parseWhisperJson(jsonPath);
  const srt = wordsToSrt(words);

  // Save outputs
  const transcriptPath = path.join(outputDir, "transcript.txt");
  const srtPath = path.join(outputDir, "transcript.srt");
  const wordsPath = path.join(outputDir, "words.json");

  fs.writeFileSync(transcriptPath, text);
  fs.writeFileSync(srtPath, srt);
  fs.writeFileSync(wordsPath, JSON.stringify(words, null, 2));

  console.log("  Transcript saved to:", transcriptPath);
  console.log("  SRT saved to:", srtPath);

  // Clean up WAV file (large)
  fs.unlinkSync(wavPath);

  return { text, words, srt };
}
