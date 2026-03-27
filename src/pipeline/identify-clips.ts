import Anthropic from "@anthropic-ai/sdk";
import fs from "fs";
import path from "path";

export interface ClipSegment {
  clipNumber: number;
  title: string;
  description: string;
  transcript: string;
  hookScore: number;
}

export async function identifyClips(
  anthropicApiKey: string,
  transcript: string,
  srt: string,
  outputDir: string,
  maxClips: number = 5
): Promise<ClipSegment[]> {
  console.log("[Clip ID] Analyzing transcript to find viral clip segments...");

  const client = new Anthropic({ apiKey: anthropicApiKey });

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: `You are a viral social media content editor. Analyze this transcript from a long-form video and identify the ${maxClips} best segments that would make compelling standalone short-form clips for YouTube Shorts, TikTok, and Instagram Reels.

Each clip should be:
- 30-90 seconds long (ideal for short-form)
- Self-contained (makes sense without context)
- Has a strong hook in the first 3 seconds
- Contains valuable/entertaining/surprising content
- Would make someone stop scrolling

TRANSCRIPT:
${transcript}

SRT FILE:
${srt}

Return ONLY a JSON array with this exact structure (no markdown, no code blocks):
[
  {
    "clipNumber": 1,
    "title": "Short catchy title for the clip",
    "description": "Why this clip would go viral",
    "transcript": "The exact transcript text for this clip segment, word for word from the transcript above",
    "hookScore": 8
  }
]

hookScore is 1-10 rating of how strong the opening hook is. Order clips by hookScore descending.`,
      },
    ],
  });

  const text =
    response.content[0].type === "text" ? response.content[0].text : "";

  let clips: ClipSegment[];
  try {
    // Try to parse directly, or extract JSON from the response
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error("No JSON array found in response");
    clips = JSON.parse(jsonMatch[0]);
  } catch (e) {
    console.error("Failed to parse clips JSON:", text);
    throw new Error(`Failed to parse clip segments from AI response: ${e}`);
  }

  // Save clips
  const clipsPath = path.join(outputDir, "clips.json");
  fs.writeFileSync(clipsPath, JSON.stringify(clips, null, 2));
  console.log(`  Found ${clips.length} clips, saved to:`, clipsPath);

  for (const clip of clips) {
    console.log(
      `  Clip ${clip.clipNumber}: "${clip.title}" (hook: ${clip.hookScore}/10)`
    );
  }

  return clips;
}
