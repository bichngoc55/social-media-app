import { GoogleAuth } from "google-auth-library";

const PROJECT_ID = process.env.GCS_PROJECT_ID!;
const LOCATION = "europe-west1";
const EMBEDDING_MODEL = "multimodalembedding@001";
const GEMINI_MODEL = "gemini-2.5-flash";
let cachedAuth: GoogleAuth | null = null;
let cachedAccessToken: { token: string; expiry: number } | null = null;

export function normalizeVector(vector: number[]): number[] {
  const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
  return magnitude === 0 ? vector : vector.map((val) => val / magnitude);
}

async function getAccessToken(): Promise<string> {
  const now = Date.now();

  if (cachedAccessToken && cachedAccessToken.expiry > now + 60000) {
    return cachedAccessToken.token;
  }

  if (!cachedAuth) {
    cachedAuth = new GoogleAuth({
      scopes: ["https://www.googleapis.com/auth/cloud-platform"],
    });
  }

  const client = await cachedAuth.getClient();
  const tokenResponse = await client.getAccessToken();

  cachedAccessToken = {
    token: tokenResponse.token!,
    expiry: now + 3600000,
  };

  return cachedAccessToken.token;
}

function convertToGsUri(url: string): string {
  if (url.startsWith("gs://")) return url;
  const match = url.match(/https:\/\/storage\.googleapis\.com\/([^\/]+)\/(.+)/);
  if (match) return `gs://${match[1]}/${match[2]}`;
  return url;
}

export async function getMultimodalEmbedding(
  text?: string,
  imageUrl?: string,
  videoUrl?: string
): Promise<number[]> {
  const accessToken = await getAccessToken();
  const endpoint = `https://${LOCATION}-aiplatform.googleapis.com/v1/projects/${PROJECT_ID}/locations/${LOCATION}/publishers/google/models/${EMBEDDING_MODEL}:predict`;

  const instance: any = {};

  if (text) instance.text = text;
  if (imageUrl) {
    if (
      imageUrl.includes("storage.googleapis.com") ||
      imageUrl.startsWith("gs://")
    ) {
      instance.image = { gcsUri: convertToGsUri(imageUrl) };
    } else {
      const res = await fetch(imageUrl);
      if (!res.ok) throw new Error(`Failed to fetch image: ${res.statusText}`);
      const buffer = await res.arrayBuffer();
      instance.image = {
        bytesBase64Encoded: Buffer.from(buffer).toString("base64"),
      };
    }
  }
  if (videoUrl) {
    if (
      !videoUrl.includes("storage.googleapis.com") &&
      !videoUrl.startsWith("gs://")
    ) {
      throw new Error("Video must be in Google Cloud Storage for embedding");
    }
    instance.video = { gcsUri: convertToGsUri(videoUrl) };
  }

  if (Object.keys(instance).length === 0)
    throw new Error("No content provided");

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ instances: [instance] }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Embedding error: ${error}`);
  }

  const data = await response.json();
  const pred = data.predictions?.[0];

  if (pred?.imageEmbedding) return pred.imageEmbedding;
  if (pred?.textEmbedding) return pred.textEmbedding;
  if (pred?.videoEmbeddings?.[0]?.embedding)
    return pred.videoEmbeddings[0].embedding;

  throw new Error("No embedding returned");
}

const safetySettings = [
  { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
  { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
  { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
  { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
];

export async function analyzePostWithGemini(
  text?: string,
  imageUrl?: string,
  videoUrl?: string
): Promise<{
  sentimentScore: number;
  emotion: "POSITIVE" | "NEGATIVE" | "NEUTRAL";
  harmful: boolean;
  harmfulTypes: string[];
  flags?: string[];
}> {
  const accessToken = await getAccessToken();
  const endpoint = `https://${LOCATION}-aiplatform.googleapis.com/v1/projects/${PROJECT_ID}/locations/${LOCATION}/publishers/google/models/${GEMINI_MODEL}:generateContent`;

  const parts: any[] = [];

  const prompt = `Analyze this social media post (caption + image/video). Return ONLY valid JSON, no markdown, no explanation.

{
  "sentimentScore": number between 0.0 (extremely negative: hate, deep sadness, anger, despair) and 1.0 (extremely positive: joy, love, excitement, gratitude),
  "emotion": "POSITIVE" | "NEGATIVE" | "NEUTRAL", // POSITIVE if sentimentScore >= 0.6, NEGATIVE if <= 0.4, else NEUTRAL
  "harmful": boolean,
  "harmfulTypes": string[] — only if harmful=true, possible values: "violence","gore","blood","weapons","fighting","self_harm","suicide","cutting","eating_disorder","hate","racism","terrorism","nsfw","drugs","other",
  "flags": optional string[] e.g. "sarcasm","dark_humor","aestheticized_self_harm"
}

Detect subtle/aestheticized harm, sarcasm that flips sentiment, dark humor, etc.`;

  parts.push({ text: prompt + (text ? `\n\nPost caption: ${text}` : "") });

  if (imageUrl) {
    if (
      imageUrl.includes("storage.googleapis.com") ||
      imageUrl.startsWith("gs://")
    ) {
      parts.push({
        fileData: {
          fileUri: convertToGsUri(imageUrl),
          mimeType: imageUrl.endsWith(".png") ? "image/png" : "image/jpeg",
        },
      });
    } else {
      const res = await fetch(imageUrl);
      if (!res.ok) throw new Error("Failed to fetch image");
      const buffer = await res.arrayBuffer();
      const mime = res.headers.get("content-type") || "image/jpeg";
      parts.push({
        inlineData: {
          data: Buffer.from(buffer).toString("base64"),
          mimeType: mime,
        },
      });
    }
  }

  if (videoUrl) {
    const uri = convertToGsUri(videoUrl);
    if (!uri.startsWith("gs://")) throw new Error("Video must be in GCS");
    parts.push({
      fileData: {
        fileUri: uri,
        mimeType: "video/mp4",
      },
    });
  }

  const requestBody = {
    contents: [{ role: "user", parts }],
    safetySettings,
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.0,
    },
  };

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Gemini error: ${error}`);
  }

  const data = await response.json();
  const jsonText = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!jsonText) throw new Error("No response from Gemini");

  try {
    return JSON.parse(jsonText);
  } catch (e) {
    console.error("Gemini JSON parse failed:", jsonText);
    return {
      sentimentScore: 0.5,
      emotion: "NEUTRAL",
      harmful: false,
      harmfulTypes: [],
    };
  }
}
