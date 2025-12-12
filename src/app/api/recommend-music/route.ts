import { validateRequest } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { recommendMusicForMood } from "@/lib/vertex";

export async function POST(req: NextRequest) {
  try {
    const { user } = await validateRequest();
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { emotion, emotionScore, recentSongs } = await req.json();

    const musicRecommendation = await recommendMusicForMood(
      emotion,
      emotionScore,
      recentSongs || []
    );

    return NextResponse.json(musicRecommendation);
  } catch (error) {
    return NextResponse.json({
      songTitle: "Nuvole Bianche",
      artist: "Ludovico Einaudi",
      url: "https://www.youtube.com/watch?v=4VR-6AS0-l4",
      reason:
        "A profoundly beautiful piano piece that helps release deep emotions and brings peace to the soul.",
      albumArt: "https://i.ytimg.com/vi/4VR-6AS0-l4/maxresdefault.jpg",
    });
  }
}
