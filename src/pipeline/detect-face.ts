import Anthropic from "@anthropic-ai/sdk";
import fs from "fs";

interface FacePosition {
  x: number;
  y: number;
  imageWidth: number;
  imageHeight: number;
}

export async function detectFacePosition(
  anthropicApiKey: string,
  imagePath: string,
  sourceWidth: number,
  sourceHeight: number
): Promise<FacePosition> {
  console.log("  Detecting face position in keyframe...");

  const imageData = fs.readFileSync(imagePath);
  const base64 = imageData.toString("base64");
  const ext = imagePath.toLowerCase().endsWith(".png")
    ? "image/png"
    : "image/jpeg";

  const client = new Anthropic({ apiKey: anthropicApiKey });

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: ext, data: base64 },
          },
          {
            type: "text",
            text: `Analyze this video frame image. The original video dimensions are ${sourceWidth}x${sourceHeight} pixels.

Find the primary speaker/subject's face in the image. Return ONLY a JSON object (no markdown, no code blocks) with the X and Y pixel coordinates of the CENTER of the face, mapped to the original video dimensions:

{"x": 960, "y": 400, "imageWidth": ${sourceWidth}, "imageHeight": ${sourceHeight}}

If multiple faces are visible, use the one that appears to be the main speaker. If no face is clearly visible, estimate the center of the main subject.`,
          },
        ],
      },
    ],
  });

  const text =
    response.content[0].type === "text" ? response.content[0].text : "";

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found");
    const result = JSON.parse(jsonMatch[0]);

    console.log(`  Face detected at: (${result.x}, ${result.y})`);

    return {
      x: result.x,
      y: result.y,
      imageWidth: result.imageWidth || sourceWidth,
      imageHeight: result.imageHeight || sourceHeight,
    };
  } catch (e) {
    console.warn(
      "  Could not parse face position, defaulting to center:",
      text
    );
    return {
      x: Math.round(sourceWidth / 2),
      y: Math.round(sourceHeight / 3),
      imageWidth: sourceWidth,
      imageHeight: sourceHeight,
    };
  }
}
