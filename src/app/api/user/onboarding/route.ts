import { validateRequest } from "@/auth";
import prisma from "@/lib/prisma";
import { getTextEmbedding, normalizeVector } from "@/lib/vertex";
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

export async function POST(req: NextRequest) {
  try {
    const { user } = await validateRequest();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { interests, countryCode, provinceCode, districtCode } = body;

    if (!Array.isArray(interests) || interests.length < 3) {
      return NextResponse.json(
        { error: "Please select at least 3 interests" },
        { status: 400 }
      );
    }

    if (!countryCode) {
      return NextResponse.json(
        { error: "Country is required" },
        { status: 400 }
      );
    }

    // Get user data to generate embedding
    const userData = await prisma.user.findUnique({
      where: { id: user.id },
      select: { displayName: true, username: true, bio: true },
    });

    if (!userData) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Generate embeddings for selected interests
    const topicEmbeddings = await Promise.all(
      interests.map((topic: string) => getTextEmbedding(topic))
    );

    const vectorStrings = topicEmbeddings.map((emb) => `[${emb.join(",")}]`);
    const vectorArrayStr = `ARRAY[${vectorStrings.map((v) => `'${v}'::vector`).join(",")}]::vector[]`;
    const dim = topicEmbeddings[0].length;
    const avgDeclared = Array(dim).fill(0);
    topicEmbeddings.forEach((emb) => {
      emb.forEach((v, i) => (avgDeclared[i] += v / topicEmbeddings.length));
    });
    const normalized = normalizeVector(avgDeclared);
    const tasteVectorStr = `[${normalized.join(",")}]`;
    console.log("[ONBOARDING] Setting tasteEmbedding for user:", user.id);
    console.log("[ONBOARDING] Interests:", interests);
    console.log("[ONBOARDING] Taste embedding dim:", normalized.length);

    await prisma.$executeRaw`
      UPDATE users
      SET 
        interests = ${interests}::text[],
        "countryCode" = ${countryCode},
        "provinceCode" = ${provinceCode || null},
        "districtCode" = ${districtCode || null},
        "topicEmbeddings" = ${Prisma.raw(vectorArrayStr)},
        "tasteEmbedding" = ${tasteVectorStr}::vector
      WHERE id = ${user.id}
    `;

    console.log("[ONBOARDING] Successfully updated user with tasteEmbedding");

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in onboarding:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
