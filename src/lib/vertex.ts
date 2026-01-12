import { GoogleAuth } from "google-auth-library";

const PROJECT_ID = process.env.GCS_PROJECT_ID!;
const LOCATION = "europe-west1";
const EMBEDDING_MODEL = "multimodalembedding@001";
const TEXT_EMBEDDING_MODEL = "text-embedding-004";
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
export const VALID_HARMFUL_TYPES = [
  "VIOLENCE",
  "HATE_SPEECH",
  "NUDITY",
  "SPAM",
  "HARASSMENT",
  "SELF_HARM",
  "SUICIDE",
  "DESPAIR",
  "MISINFORMATION",
  "DANGEROUS_BEHAVIOR",
  "PSYCHOLOGICAL_HARM",
  "MANIPULATION",
  "COMMUNITY_HARM",
  "OTHER",
] as const;

const INTEREST_TAGS = [
  "Technology",
  "Sports",
  "Music",
  "Art",
  "Travel",
  "Food",
  "Fashion",
  "Photography",
  "Gaming",
  "Fitness",
  "Books",
  "Movies",
  "Science",
  "Business",
  "Education",
  "Health",
  "Nature",
  "Pets",
  "Lifestyle",
  "Relationships",
  "Mental Health",
  "Career",
  "Finance",
  "News",
  "Culture",
  "Self Improvement",
  "Entertainment",
  "Internet Culture",
] as const;

export async function analyzePostWithGemini(
  text?: string,
  imageUrl?: string,
  videoUrl?: string
): Promise<{
  sentimentScore: number;
  emotion: "POSITIVE" | "NEGATIVE" | "NEUTRAL";
  harmful: boolean;
  harmfulTypes: string[];
  primaryEmotion: string;
  topics: string[];
  wisdomOrAdviceMessage: string;
  flags?: string[];
}> {
  const accessToken = await getAccessToken();
  const endpoint = `https://${LOCATION}-aiplatform.googleapis.com/v1/projects/${PROJECT_ID}/locations/${LOCATION}/publishers/google/models/${GEMINI_MODEL}:generateContent`;

  const parts: any[] = [];
  const tagList = INTEREST_TAGS.join(", ");
  const harmfulList = VALID_HARMFUL_TYPES.join(", ");
  const prompt = `Analyze this social media post (caption + image/video if present). Return ONLY a single valid JSON object, no markdown, no explanation, no extra text.

PRIORITY INSTRUCTION:
1. Analyze the emotional state primarily from the text content.
2. Use the image/video only to support, adjust, or detect inconsistencies with the text sentiment.
3. EXCEPTION: If the text is very short, or consists mainly of emojis/hashtags, rely primarily on the image/video for sentiment analysis.

CRITICAL INSTRUCTION FOR "sentimentScore":
- For HARMFUL content: sentimentScore must be between 0.1 and 0.25 (most negative/dangerous)
- For normal negative content (not harmful): between 0.25 and 0.45
- For neutral content: between 0.45 and 0.6
  * Simple questions, requests for information/recommendations
  * Factual statements without strong emotion
  * Polite inquiries (even with "thank you", "please", etc)
  * Asking for help or advice without expressing happiness
  * IMPORTANT: Politeness does NOT equal positive emotion
- For positive content: between 0.6 and 1.0
  * ONLY if expressing clear joy, excitement, happiness, gratitude, pride, celebration, or enthusiasm
  * Must contain emotional indicators like "so happy", "amazing", "love", "excited", emojis like 😊🎉❤️
  * Not just polite - must show GENUINE positive emotion

CRITICAL INSTRUCTION FOR "topics":
The "topics" array must contain 2-5 items. 
- At least ONE item MUST be chosen exactly from this list: [${tagList}]. 
- The other items should be specific sub-topics or themes found in the post.
- "harmfulTypes": If harmful is true, choose the closest match(es) from: [${harmfulList}].
CRITICAL INSTRUCTION FOR "wisdomOrAdviceMessage":
The message must be deeply contextual and empathetic. Do NOT use generic platitudes like "stay positive." 
Instead, acknowledge the specific situation mentioned (e.g., if they mention a car breaking down, mention the car/transportation). 
Write as a supportive, wise friend. 
Max 100 characters. 

  Required JSON format:
  {
    "sentimentScore": number between 0.0 (extremely negative) and 1.0 (extremely positive),
    "emotion": "POSITIVE" | "NEGATIVE" | "NEUTRAL",           // >= 0.6 → POSITIVE, <= 0.4 → NEGATIVE, else NEUTRAL
    "primaryEmotion": string,                                 // specific emotion in lowercase, e.g. "joy", "sadness", "anger", "excitement", "gratitude", "loneliness", "pride", "relief", "fear", "disappointment", "neutral"
    "topics": string[],                                       // 1-5 main topics/themes, short lowercase phrases, e.g. ["beach vacation", "new job", "breakup", "food", "gym"]
    "wisdomOrAdviceMessage": string,                              
    "harmful": boolean,
    "harmfulTypes": string[],                                 // only if harmful=true
    "flags": string[]                                         // optional, e.g. ["sarcasm", "dark_humor"]
  }

  Be very careful with subtle/aestheticized self-harm, sarcasm that flips sentiment, dark humor, etc.`;

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
      primaryEmotion: "neutral",
      topics: [],
      wisdomOrAdviceMessage: "",
      harmful: false,
      harmfulTypes: [],
      flags: [],
    };
  }
}

export async function getTextEmbedding(text: string): Promise<number[]> {
  if (!text || text.trim().length === 0) {
    throw new Error("Text cannot be empty");
  }

  const maxRetries = 3;
  let lastError: any;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(
        `[getTextEmbedding] Attempt ${attempt}/${maxRetries} for text: "${text.substring(0, 50)}..."`
      );

      const accessToken = await getAccessToken();
      const endpoint = `https://${LOCATION}-aiplatform.googleapis.com/v1/projects/${PROJECT_ID}/locations/${LOCATION}/publishers/google/models/${TEXT_EMBEDDING_MODEL}:predict`;

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          instances: [{ content: text, task_type: "SEMANTIC_SIMILARITY" }],
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Text embedding error: ${error}`);
      }

      const data = await response.json();
      const embedding = data.predictions?.[0]?.embeddings?.values;

      if (!embedding || !Array.isArray(embedding)) {
        throw new Error("No embedding returned from text-embedding-004");
      }

      console.log(`[getTextEmbedding] Success on attempt ${attempt}`);
      return embedding;
    } catch (error: any) {
      lastError = error;
      console.error(`[getTextEmbedding] Attempt ${attempt} failed:`, {
        message: error.message,
        code: error.code,
        cause: error.cause,
        errno: error.errno,
        syscall: error.syscall,
      });

      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000; // Exponential backoff: 2s, 4s, 8s
        console.log(`[getTextEmbedding] Retrying in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  console.error(`[getTextEmbedding] All ${maxRetries} attempts failed`);
  throw lastError;
}

export interface EmotionAnalysis {
  isHarmful: boolean;
  isDepressive: boolean;
  isNegative: boolean;
  hasEmotionalConcern: boolean;
  supportiveMessage: string | null;
}

export async function analyzeQueryEmotion(
  query: string
): Promise<EmotionAnalysis> {
  try {
    const accessToken = await getAccessToken();
    const endpoint = `https://${LOCATION}-aiplatform.googleapis.com/v1/projects/${PROJECT_ID}/locations/${LOCATION}/publishers/google/models/${GEMINI_MODEL}:generateContent`;

    const prompt = `Analyze the following search query for emotional content and safety concerns.

Detect if the query contains:
1. Harmful content (violence, self-harm, dangerous behavior, suicide ideation)
2. Signs of depression or suicidal thoughts (e.g., "I want to die", "end my life", "suicide methods")
3. Negative self-talk (e.g., "I'm ugly", "I'm worthless", "nobody likes me", "I hate myself")

Query: "${query}"

Return ONLY a single valid JSON object with NO markdown formatting, NO code blocks, NO extra text:
{
  "isHarmful": boolean,
  "isDepressive": boolean,
  "isNegative": boolean,
  "supportiveMessage": "string or null - only if concerns detected, provide a brief (50-100 chars), empathetic, supportive message to console them or provide gentle advice"
}

Examples:
- For "I'm so ugly": {"isHarmful": false, "isDepressive": false, "isNegative": true, "supportiveMessage": "You are valuable beyond appearance. Everyone has unique beauty. 💙"}
- For "I want to end it all": {"isHarmful": true, "isDepressive": true, "isNegative": true, "supportiveMessage": "Please reach out to someone. You matter and help is available. 988 Lifeline."}
- For "pizza recipes": {"isHarmful": false, "isDepressive": false, "isNegative": false, "supportiveMessage": null}`;

    const requestBody = {
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }],
        },
      ],
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
      console.error("Gemini emotion analysis error:", error);
      return {
        isHarmful: false,
        isDepressive: false,
        isNegative: false,
        hasEmotionalConcern: false,
        supportiveMessage: null,
      };
    }

    const data = await response.json();
    const jsonText = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!jsonText) {
      return {
        isHarmful: false,
        isDepressive: false,
        isNegative: false,
        hasEmotionalConcern: false,
        supportiveMessage: null,
      };
    }

    const analysis = JSON.parse(jsonText);
    const hasEmotionalConcern =
      analysis.isHarmful || analysis.isDepressive || analysis.isNegative;

    return {
      isHarmful: analysis.isHarmful || false,
      isDepressive: analysis.isDepressive || false,
      isNegative: analysis.isNegative || false,
      hasEmotionalConcern,
      supportiveMessage: hasEmotionalConcern
        ? analysis.supportiveMessage
        : null,
    };
  } catch (error) {
    console.error("Error analyzing query emotion:", error);
    return {
      isHarmful: false,
      isDepressive: false,
      isNegative: false,
      hasEmotionalConcern: false,
      supportiveMessage: null,
    };
  }
}

export interface MusicRecommendation {
  songTitle: string;
  artist: string;
  url: string;
  reason: string;
  albumArt?: string; // YouTube thumbnail
}

const MOOD_MUSIC_LIBRARY = {
  sad: [
    {
      songTitle: "Someone Like You",
      artist: "Adele",
      videoId: "hLQl3WQQoQ0",
      reason:
        "Emotional ballad that validates feelings of loss and helps process sadness",
    },
    {
      songTitle: "Let Her Go",
      artist: "Passenger",
      videoId: "RBumgq5yVrA",
      reason: "Gentle acoustic song about acceptance and moving forward",
    },
    {
      songTitle: "Say Something",
      artist: "A Great Big World",
      videoId: "-2U0Ivkn2Ds",
      reason: "Piano-driven ballad that helps express difficult emotions",
    },
    {
      songTitle: "Fix You",
      artist: "Coldplay",
      videoId: "k4V3Mo61fJM",
      reason: "Uplifting message of hope and healing after difficult times",
    },
    {
      songTitle: "The Scientist",
      artist: "Coldplay",
      videoId: "RB-RcX5DS5A",
      reason: "Reflective song about regret and wanting to make things right",
    },
    {
      songTitle: "Skinny Love",
      artist: "Bon Iver",
      videoId: "ssdgFoHLwnk",
      reason: "Raw emotional expression through minimalist indie folk",
    },
    {
      songTitle: "Mad World",
      artist: "Gary Jules",
      videoId: "4N3N1MlvVc4",
      reason: "Haunting melody that resonates with feelings of isolation",
    },
    {
      songTitle: "When I Was Your Man",
      artist: "Bruno Mars",
      videoId: "ekzHIouo8Q4",
      reason: "Piano ballad about regret and learning from past mistakes",
    },
    {
      songTitle: "All Too Well",
      artist: "Taylor Swift",
      videoId: "tollGa3S0o8",
      reason: "Detailed storytelling that validates emotional memories",
    },
    {
      songTitle: "Breathe Me",
      artist: "Sia",
      videoId: "ghPcYqn0p4Y",
      reason: "Emotional vulnerability that encourages self-compassion",
    },
    {
      songTitle: "Falling",
      artist: "Harry Styles",
      videoId: "FHKCz7OznTw",
      reason: "Stripped-back piano ballad about vulnerability",
    },
    {
      songTitle: "drivers license",
      artist: "Olivia Rodrigo",
      videoId: "ZmDBbnmKpqQ",
      reason: "Raw teenage emotion that validates heartbreak",
    },
    {
      songTitle: "Lost Without You",
      artist: "Freya Ridings",
      videoId: "fw_f2CuBP64",
      reason: "Powerful piano ballad about emotional dependence",
    },
    {
      songTitle: "Somebody That I Used to Know",
      artist: "Gotye",
      videoId: "8UVNT4wvIGY",
      reason: "Processing the end of a relationship with acceptance",
    },
    {
      songTitle: "Stay With Me",
      artist: "Sam Smith",
      videoId: "pB-5XG-DbAA",
      reason: "Gospel-infused soul about loneliness and longing",
    },
    {
      songTitle: "Wings",
      artist: "Birdy",
      videoId: "Bj6ui1rgBqo",
      reason: "Delicate vocals that validate vulnerable emotions",
    },
    {
      songTitle: "Skyfall",
      artist: "Adele",
      videoId: "DeumyOzKqgI",
      reason: "Epic orchestral ballad about resilience through pain",
    },
    {
      songTitle: "Stone Cold",
      artist: "Demi Lovato",
      videoId: "WDAd0S92Uko",
      reason: "Raw emotional power about unrequited love",
    },
    {
      songTitle: "When We Were Young",
      artist: "Adele",
      videoId: "DDWKuo3gXMQ",
      reason: "Nostalgic reflection on past relationships",
    },
    {
      songTitle: "The Night We Met",
      artist: "Lord Huron",
      videoId: "wGF7PswOENQ",
      reason: "Longing for the past through melancholic folk",
    },
    {
      songTitle: "Hello",
      artist: "Adele",
      videoId: "YQHsXMglC9A",
      reason: "Powerful vocals about closure and moving on",
    },
    {
      songTitle: "Hurt",
      artist: "Johnny Cash",
      videoId: "8AHCfZTRGiI",
      reason: "Deeply reflective cover about life's regrets",
    },
    {
      songTitle: "Yesterday",
      artist: "The Beatles",
      videoId: "NrgmdIPbTJI",
      reason: "Timeless classic about nostalgia and loss",
    },
    {
      songTitle: "Tears in Heaven",
      artist: "Eric Clapton",
      videoId: "JxPj3GAYYZ0",
      reason: "Tender tribute to loss and healing",
    },
    {
      songTitle: "Nothing Compares 2 U",
      artist: "Sinéad O'Connor",
      videoId: "0-EF60neguk",
      reason: "Raw emotion about missing someone deeply",
    },
    {
      songTitle: "Everyone Hurts",
      artist: "R.E.M.",
      videoId: "5rOiW_xY-kc",
      reason: "Reassurance that pain is universal and temporary",
    },
    {
      songTitle: "Un-break My Heart",
      artist: "Toni Braxton",
      videoId: "p2Rch6WvPJE",
      reason: "Powerful R&B ballad about heartbreak",
    },
    {
      songTitle: "Back to Black",
      artist: "Amy Winehouse",
      videoId: "TJAfLE39ZZ8",
      reason: "Soul-jazz expression of loss and grief",
    },
    {
      songTitle: "Creep",
      artist: "Radiohead",
      videoId: "XFkzRNyygfk",
      reason: "Alternative rock anthem about self-doubt and alienation",
    },
    {
      songTitle: "Hurt",
      artist: "Christina Aguilera",
      videoId: "VX0qRKKY8Ow",
      reason: "Powerful vocals about regret and reconciliation",
    },
  ],
  happy: [
    {
      songTitle: "Happy",
      artist: "Pharrell Williams",
      videoId: "ZbZSe6N_BXs",
      reason: "Infectious rhythm that naturally elevates mood and energy",
    },
    {
      songTitle: "Can't Stop the Feeling",
      artist: "Justin Timberlake",
      videoId: "ru0K8uYEZWw",
      reason: "Upbeat pop that encourages movement and joy",
    },
    {
      songTitle: "Blinding Lights",
      artist: "The Weeknd",
      videoId: "4NRXx6U8ABQ",
      reason: "Synth-driven energy that amplifies positive emotions",
    },
    {
      songTitle: "Shake It Off",
      artist: "Taylor Swift",
      videoId: "nfWlot6h_JM",
      reason: "Carefree anthem about not taking things too seriously",
    },
    {
      songTitle: "Uptown Funk",
      artist: "Mark Ronson ft. Bruno Mars",
      videoId: "OPf0YbXqDm0",
      reason: "Funky groove that gets you moving and smiling",
    },
    {
      songTitle: "24K Magic",
      artist: "Bruno Mars",
      videoId: "UqyT8IEBkvY",
      reason: "High-energy funk that celebrates good times",
    },
    {
      songTitle: "Shut Up and Dance",
      artist: "Walk the Moon",
      videoId: "6JCLY0Rlx6Q",
      reason: "Infectious rock-pop that encourages spontaneity",
    },
    {
      songTitle: "September",
      artist: "Earth, Wind & Fire",
      videoId: "Gs069dndIYk",
      reason: "Timeless funk-soul that brings instant joy",
    },
    {
      songTitle: "Mr. Blue Sky",
      artist: "Electric Light Orchestra",
      videoId: "wuJIqmha2Hc",
      reason: "Orchestral rock that captures pure happiness",
    },
    {
      songTitle: "Dancing Queen",
      artist: "ABBA",
      videoId: "xFrGuyw1V8s",
      reason: "Disco classic that celebrates carefree joy",
    },
    {
      songTitle: "High Hopes",
      artist: "Panic! At The Disco",
      videoId: "IPXIgEAGe4U",
      reason: "Motivational anthem about maintaining optimism",
    },
    {
      songTitle: "Don't Stop Me Now",
      artist: "Queen",
      videoId: "HgzGwKwLmgM",
      reason: "Rock anthem about unstoppable energy and joy",
    },
    {
      songTitle: "Best Day of My Life",
      artist: "American Authors",
      videoId: "Y66j_BUCBMY",
      reason: "Indie-pop celebration of living in the moment",
    },
    {
      songTitle: "On Top of the World",
      artist: "Imagine Dragons",
      videoId: "w5tWYmIOWGk",
      reason: "Feel-good anthem about achieving dreams",
    },
    {
      songTitle: "Count on Me",
      artist: "Bruno Mars",
      videoId: "feeuoERYOV0",
      reason: "Uplifting song about friendship and support",
    },
    {
      songTitle: "Roar",
      artist: "Katy Perry",
      videoId: "CevxZvSJLk8",
      reason: "Empowerment anthem that boosts confidence",
    },
    {
      songTitle: "Firework",
      artist: "Katy Perry",
      videoId: "QGJuMBdaqIw",
      reason: "Inspiring message about inner strength and worth",
    },
    {
      songTitle: "Good Life",
      artist: "OneRepublic",
      videoId: "jZhQOvvV45w",
      reason: "Optimistic anthem about appreciating life",
    },
    {
      songTitle: "A Sky Full of Stars",
      artist: "Coldplay",
      videoId: "VPRjCeoBqrI",
      reason: "Electronic-rock fusion that lifts spirits",
    },
    {
      songTitle: "Sugar",
      artist: "Maroon 5",
      videoId: "09R8_2nJtjg",
      reason: "Sweet pop-funk energy that makes you smile",
    },
    {
      songTitle: "Walking on Sunshine",
      artist: "Katrina and the Waves",
      videoId: "iPUmE-tne5U",
      reason: "Pure joy in musical form with infectious energy",
    },
    {
      songTitle: "I Gotta Feeling",
      artist: "Black Eyed Peas",
      videoId: "uSD4vsh1zDA",
      reason: "Party anthem about celebrating good times",
    },
    {
      songTitle: "Good as Hell",
      artist: "Lizzo",
      videoId: "SmbmeOgWsqE",
      reason: "Self-love anthem with empowering energy",
    },
    {
      songTitle: "Levitating",
      artist: "Dua Lipa",
      videoId: "TUVcZfQe-Kw",
      reason: "Disco-pop that makes you want to dance",
    },
    {
      songTitle: "Dynamite",
      artist: "BTS",
      videoId: "gdZLi9oWNZg",
      reason: "International hit with infectious positive energy",
    },
    {
      songTitle: "Good Vibrations",
      artist: "The Beach Boys",
      videoId: "Eab_beh07HU",
      reason: "Classic feel-good harmony that lifts spirits",
    },
    {
      songTitle: "Three Little Birds",
      artist: "Bob Marley",
      videoId: "zaGUr6wzyT8",
      reason: "Reggae reassurance that everything will be alright",
    },
    {
      songTitle: "Lovely Day",
      artist: "Bill Withers",
      videoId: "bEeaS6fuUoA",
      reason: "Soul classic about simple happiness",
    },
    {
      songTitle: "Don't Worry Be Happy",
      artist: "Bobby McFerrin",
      videoId: "d-diB65scQU",
      reason: "Carefree a cappella that promotes positivity",
    },
    {
      songTitle: "Here Comes the Sun",
      artist: "The Beatles",
      videoId: "KQetemT1sWc",
      reason: "Optimistic classic about hope and renewal",
    },
    {
      songTitle: "Beautiful Day",
      artist: "U2",
      videoId: "co6WMzDOh1o",
      reason: "Anthemic rock about appreciating life",
    },
    {
      songTitle: "Celebration",
      artist: "Kool & The Gang",
      videoId: "3GwjfUFyY6M",
      reason: "Timeless party anthem",
    },
    {
      songTitle: "I'm a Believer",
      artist: "The Monkees",
      videoId: "wB9YIsKIEbA",
      reason: "Classic pop-rock about finding joy",
    },
    {
      songTitle: "Send Me on My Way",
      artist: "Rusted Root",
      videoId: "IGMabBGydC0",
      reason: "Upbeat folk-rock perfect for adventures",
    },
    {
      songTitle: "I Want You Back",
      artist: "Jackson 5",
      videoId: "s3Q80mk7bxE",
      reason: "Motown classic with irresistible groove",
    },
  ],
  calm: [
    {
      songTitle: "Weightless",
      artist: "Marconi Union",
      videoId: "UfcAVejslrU",
      reason:
        "Scientifically proven to reduce anxiety by 65% through ambient soundscapes",
    },
    {
      songTitle: "Holocene",
      artist: "Bon Iver",
      videoId: "TWcyIpul8OE",
      reason: "Ethereal indie folk that creates peaceful introspection",
    },
    {
      songTitle: "To Build a Home",
      artist: "The Cinematic Orchestra",
      videoId: "oUFJJNQGwhk",
      reason: "Piano and strings that evoke gentle emotional release",
    },
    {
      songTitle: "Intro",
      artist: "The xx",
      videoId: "3gxNW2Ulpwk",
      reason: "Minimalist indie that creates space for quiet reflection",
    },
    {
      songTitle: "Teardrop",
      artist: "Massive Attack",
      videoId: "u7K72X4eo_s",
      reason: "Trip-hop classic with hypnotic calming rhythm",
    },
    {
      songTitle: "Saturn",
      artist: "Sleeping At Last",
      videoId: "dzNvk80XY9s",
      reason: "Orchestral ballad that provides gentle emotional comfort",
    },
    {
      songTitle: "River Flows in You",
      artist: "Yiruma",
      videoId: "7maJOI3QMu0",
      reason: "Piano instrumental that promotes meditation and calm",
    },
    {
      songTitle: "Clair de Lune",
      artist: "Debussy",
      videoId: "CvFH_6DNRCY",
      reason: "Classical piano piece known for inducing tranquility",
    },
    {
      songTitle: "Youth",
      artist: "Daughter",
      videoId: "2QT5eGHCJdE",
      reason: "Gentle indie with soothing vocal harmonies",
    },
    {
      songTitle: "Watermark",
      artist: "Enya",
      videoId: "mSCoNb-_uw0",
      reason: "New age ambient that deeply relaxes the mind",
    },
    {
      songTitle: "Only Time",
      artist: "Enya",
      videoId: "7wfYIMyS_dI",
      reason: "Ethereal vocals that promote peace and patience",
    },
    {
      songTitle: "Skinny Love",
      artist: "Birdy",
      videoId: "aNzCDt2eidg",
      reason: "Delicate piano cover that soothes the soul",
    },
    {
      songTitle: "Comptine d'un autre été",
      artist: "Yann Tiersen",
      videoId: "NvryolGa19A",
      reason: "Piano instrumental from Amélie that evokes calm nostalgia",
    },
    {
      songTitle: "Experience",
      artist: "Ludovico Einaudi",
      videoId: "hN_q-_nGv4U",
      reason: "Building piano piece that provides emotional catharsis",
    },
    {
      songTitle: "Nuvole Bianche",
      artist: "Ludovico Einaudi",
      videoId: "kcihcYEOeic",
      reason: "Flowing piano that creates meditative atmosphere",
    },
    {
      songTitle: "Concerning Hobbits",
      artist: "Howard Shore",
      videoId: "_pGaz_qN0cw",
      reason: "Peaceful orchestral piece from Lord of the Rings",
    },
    {
      songTitle: "Adagio for Strings",
      artist: "Samuel Barber",
      videoId: "izQsgE0L450",
      reason: "Moving classical piece that facilitates deep reflection",
    },
    {
      songTitle: "Gymnopédie No.1",
      artist: "Erik Satie",
      videoId: "S-Xm7s9eGxU",
      reason: "Minimalist piano that promotes tranquility",
    },
    {
      songTitle: "The Blue Danube",
      artist: "Johann Strauss II",
      videoId: "_CTYymbbEL4",
      reason: "Classical waltz that creates peaceful elegance",
    },
    {
      songTitle: "Arrival of the Birds",
      artist: "The Cinematic Orchestra",
      videoId: "MqoANESQ4cQ",
      reason: "Orchestral piece that builds to peaceful crescendo",
    },
    {
      songTitle: "Amber",
      artist: "Autechre",
      videoId: "zMaRguoo3TY",
      reason: "Electronic ambient that creates peaceful space",
    },
    {
      songTitle: "Strawberry Swing",
      artist: "Coldplay",
      videoId: "h3pJZSTQqIg",
      reason: "Gentle alternative rock with soothing melody",
    },
    {
      songTitle: "The Rain Song",
      artist: "Led Zeppelin",
      videoId: "zDVnjCwCYCs",
      reason: "Acoustic rock ballad with peaceful flow",
    },
    {
      songTitle: "Somewhere Only We Know",
      artist: "Keane",
      videoId: "Oextk-If8HQ",
      reason: "Soft rock that evokes peaceful nostalgia",
    },
    {
      songTitle: "Mykonos",
      artist: "Fleet Foxes",
      videoId: "DT-dxG4WWf4",
      reason: "Indie folk harmony that calms the mind",
    },
    {
      songTitle: "Mad About You",
      artist: "Hooverphonic",
      videoId: "fZNSzGL1pNA",
      reason: "Trip-hop with soothing orchestration",
    },
    {
      songTitle: "Dust in the Wind",
      artist: "Kansas",
      videoId: "tH2w6Oxx0kQ",
      reason: "Philosophical soft rock with gentle acoustic guitar",
    },
    {
      songTitle: "Canon in D",
      artist: "Pachelbel",
      videoId: "NlprozGcs80",
      reason: "Timeless classical piece that promotes serenity",
    },
    {
      songTitle: "Moon River",
      artist: "Audrey Hepburn",
      videoId: "uirKd_X72Ew",
      reason: "Classic gentle melody that soothes",
    },
    {
      songTitle: "Spiegel im Spiegel",
      artist: "Arvo Pärt",
      videoId: "TJ6Mzvh3XCc",
      reason: "Minimalist composition for deep calm",
    },
  ],
  anxious: [
    {
      songTitle: "Weightless",
      artist: "Marconi Union",
      videoId: "UfcAVejslrU",
      reason:
        "Clinically proven to reduce anxiety through therapeutic sound design",
    },
    {
      songTitle: "Breathe Me",
      artist: "Sia",
      videoId: "ghPcYqn0p4Y",
      reason: "Validates anxious feelings while encouraging self-compassion",
    },
    {
      songTitle: "Holocene",
      artist: "Bon Iver",
      videoId: "TWcyIpul8OE",
      reason: "Puts worries in perspective through ethereal soundscapes",
    },
    {
      songTitle: "Only Time",
      artist: "Enya",
      videoId: "7wfYIMyS_dI",
      reason: "Calming reminder that anxiety passes with time",
    },
    {
      songTitle: "Gravity",
      artist: "Sara Bareilles",
      videoId: "rEXhAMtbaec",
      reason: "Acknowledges struggle while offering gentle hope",
    },
    {
      songTitle: "Breathin",
      artist: "Ariana Grande",
      videoId: "kN0iD0pI3o0",
      reason: "Pop anthem specifically about managing panic and anxiety",
    },
    {
      songTitle: "1-800-273-8255",
      artist: "Logic ft. Alessia Cara",
      videoId: "cycUHgg0zzU",
      reason: "Message of hope and reaching out during dark moments",
    },
    {
      songTitle: "Unsteady",
      artist: "X Ambassadors",
      videoId: "V0lw3qylVfY",
      reason: "Rock ballad about needing support when feeling unstable",
    },
    {
      songTitle: "Demons",
      artist: "Imagine Dragons",
      videoId: "mWRsgZuwf_8",
      reason: "Acknowledges inner struggles with supportive message",
    },
    {
      songTitle: "The A Team",
      artist: "Ed Sheeran",
      videoId: "UAWcs5H-qgQ",
      reason: "Gentle storytelling that validates difficult experiences",
    },
    {
      songTitle: "Elastic Heart",
      artist: "Sia",
      videoId: "KWZGAExj-es",
      reason: "Resilience anthem about surviving emotional pain",
    },
    {
      songTitle: "Fix You",
      artist: "Coldplay",
      videoId: "k4V3Mo61fJM",
      reason: "Comforting message about healing and support",
    },
    {
      songTitle: "Shake It Out",
      artist: "Florence + The Machine",
      videoId: "WbN0nX61rIs",
      reason: "Cathartic anthem about releasing anxiety and regret",
    },
    {
      songTitle: "Dog Days Are Over",
      artist: "Florence + The Machine",
      videoId: "iWOyfLBYtuU",
      reason: "Energetic release of anxious tension through movement",
    },
    {
      songTitle: "Lovely",
      artist: "Billie Eilish ft. Khalid",
      videoId: "V1Pl8CzNzCw",
      reason: "Validates feeling trapped by anxiety with gentle vocals",
    },
    {
      songTitle: "Stressed Out",
      artist: "Twenty One Pilots",
      videoId: "pXRviuL6vMY",
      reason: "Relatable lyrics about pressure and anxiety",
    },
    {
      songTitle: "Ride",
      artist: "Twenty One Pilots",
      videoId: "Pw-0pbY9JeU",
      reason: "Philosophical approach to managing life's uncertainties",
    },
    {
      songTitle: "Brave",
      artist: "Sara Bareilles",
      videoId: "QUQsqBqxoR4",
      reason: "Encouraging anthem about finding voice despite fear",
    },
    {
      songTitle: "Fight Song",
      artist: "Rachel Platten",
      videoId: "xo1VInw-SKc",
      reason: "Empowerment anthem for pushing through anxiety",
    },
    {
      songTitle: "Hall of Fame",
      artist: "The Script ft. will.i.am",
      videoId: "mk48xRzuNvA",
      reason: "Motivational message about overcoming self-doubt",
    },
    {
      songTitle: "Let It Be",
      artist: "The Beatles",
      videoId: "QDYfEBY9NM4",
      reason: "Peaceful message about acceptance and letting go",
    },
    {
      songTitle: "Stand By Me",
      artist: "Ben E. King",
      videoId: "hwZNL7QVJjE",
      reason: "Reassuring classic about support and companionship",
    },
    {
      songTitle: "Lean on Me",
      artist: "Bill Withers",
      videoId: "fOZ-MySzAac",
      reason: "Soul anthem about mutual support and friendship",
    },
    {
      songTitle: "Titanium",
      artist: "David Guetta ft. Sia",
      videoId: "JRfuAukYTKg",
      reason: "Empowerment anthem about inner strength",
    },
    {
      songTitle: "Stronger",
      artist: "Kelly Clarkson",
      videoId: "Xn676-fLq7I",
      reason: "Pop-rock about resilience after hardship",
    },
    {
      songTitle: "Survivor",
      artist: "Destiny's Child",
      videoId: "Wmc8bQoL-J0",
      reason: "R&B anthem about perseverance",
    },
    {
      songTitle: "Unwritten",
      artist: "Natasha Bedingfield",
      videoId: "b7k0a5hYnSI",
      reason: "Optimistic message about new beginnings",
    },
    {
      songTitle: "Imagine",
      artist: "John Lennon",
      videoId: "YkgkThdzX-8",
      reason: "Peaceful vision that calms worry",
    },
    {
      songTitle: "What a Wonderful World",
      artist: "Louis Armstrong",
      videoId: "VqhCQZaH4Vs",
      reason: "Jazz classic that promotes gratitude and peace",
    },
    {
      songTitle: "Somewhere Over the Rainbow",
      artist: "Israel Kamakawiwoʻole",
      videoId: "V1bFr2SWP1I",
      reason: "Ukulele version that brings instant calm and hope",
    },
  ],
};

export async function recommendMusicForMood(
  emotion: string | null,
  emotionScore: number | null,
  recentSongs: string[] = []
): Promise<MusicRecommendation> {
  try {
    let moodCategory: keyof typeof MOOD_MUSIC_LIBRARY = "calm";

    if (emotion === "POSITIVE") {
      moodCategory = "happy";
    } else if (emotion === "NEGATIVE") {
      // Check score to distinguish between sad and anxious
      if (emotionScore !== null && emotionScore < 0.3) {
        moodCategory = "anxious";
      } else {
        moodCategory = "sad";
      }
    } else if (emotionScore !== null) {
      // If emotion is NEUTRAL or null, use score
      if (emotionScore < 0.3) {
        moodCategory = "anxious";
      } else if (emotionScore < 0.4) {
        moodCategory = "sad";
      } else if (emotionScore > 0.7) {
        moodCategory = "happy";
      } else {
        moodCategory = "calm";
      }
    }

    // Get songs for this mood
    const moodSongs = MOOD_MUSIC_LIBRARY[moodCategory];

    // Filter out recently played songs using consistent key format
    const availableSongs = moodSongs.filter((song) => {
      const songKey = `${song.songTitle} - ${song.artist}`;
      return !recentSongs.includes(songKey);
    });

    // If all songs have been played, reset and use all songs
    const songsToChooseFrom =
      availableSongs.length > 0 ? availableSongs : moodSongs;

    // Pick a random song
    const randomIndex = Math.floor(Math.random() * songsToChooseFrom.length);
    const selectedSong = songsToChooseFrom[randomIndex];

    return {
      songTitle: selectedSong.songTitle,
      artist: selectedSong.artist,
      url: `https://www.youtube.com/watch?v=${selectedSong.videoId}`,
      reason: selectedSong.reason,
      albumArt: `https://i.ytimg.com/vi/${selectedSong.videoId}/hqdefault.jpg`,
    };
  } catch (error) {
    // Fallback to Weightless
    return {
      songTitle: "Weightless",
      artist: "Marconi Union",
      url: "https://www.youtube.com/watch?v=UfcAVejslrU",
      reason: "Scientifically proven to reduce anxiety by 65%",
      albumArt: "https://i.ytimg.com/vi/UfcAVejslrU/maxresdefault.jpg",
    };
  }
}
