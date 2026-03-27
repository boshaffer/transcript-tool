import fs from "fs";
import path from "path";

const ASSEMBLYAI_BASE = "https://api.assemblyai.com/v2";

interface TranscriptWord {
  text: string;
  start: number;
  end: number;
  confidence: number;
  speaker?: string;
}

interface TranscriptResult {
  text: string;
  words: TranscriptWord[];
  srt: string;
}

async function uploadFile(
  apiKey: string,
  filePath: string
): Promise<string> {
  const data = fs.readFileSync(filePath);
  const response = await fetch(`${ASSEMBLYAI_BASE}/upload`, {
    method: "POST",
    headers: {
      authorization: apiKey,
      "content-type": "application/octet-stream",
    },
    body: data,
  });
  if (!response.ok) throw new Error(`Upload failed: ${response.statusText}`);
  const json = (await response.json()) as { upload_url: string };
  return json.upload_url;
}

async function pollTranscript(
  apiKey: string,
  transcriptId: string
): Promise<any> {
  while (true) {
    const response = await fetch(
      `${ASSEMBLYAI_BASE}/transcript/${transcriptId}`,
      { headers: { authorization: apiKey } }
    );
    const data = await response.json();
    if (data.status === "completed") return data;
    if (data.status === "error")
      throw new Error(`Transcription failed: ${data.error}`);
    console.log("  Transcription status:", data.status);
    await new Promise((r) => setTimeout(r, 3000));
  }
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
  apiKey: string,
  videoPath: string,
  outputDir: string
): Promise<TranscriptResult> {
  console.log("[1/3] Uploading video for transcription...");

  let audioUrl: string;
  if (videoPath.startsWith("http://") || videoPath.startsWith("https://")) {
    audioUrl = videoPath;
  } else {
    audioUrl = await uploadFile(apiKey, videoPath);
  }

  console.log("[2/3] Starting transcription...");
  const response = await fetch(`${ASSEMBLYAI_BASE}/transcript`, {
    method: "POST",
    headers: {
      authorization: apiKey,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      audio_url: audioUrl,
      speaker_labels: true,
    }),
  });

  if (!response.ok)
    throw new Error(`Transcription request failed: ${response.statusText}`);

  const { id } = (await response.json()) as { id: string };
  console.log("  Transcript ID:", id);

  console.log("[3/3] Waiting for transcription to complete...");
  const result = await pollTranscript(apiKey, id);

  const words: TranscriptWord[] = result.words || [];
  const srt = wordsToSrt(words);

  // Save outputs
  const transcriptPath = path.join(outputDir, "transcript.txt");
  const srtPath = path.join(outputDir, "transcript.srt");
  const wordsPath = path.join(outputDir, "words.json");

  fs.writeFileSync(transcriptPath, result.text);
  fs.writeFileSync(srtPath, srt);
  fs.writeFileSync(wordsPath, JSON.stringify(words, null, 2));

  console.log("  Transcript saved to:", transcriptPath);
  console.log("  SRT saved to:", srtPath);

  return { text: result.text, words, srt };
}
