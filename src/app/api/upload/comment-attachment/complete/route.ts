import { validateRequest } from "@/auth";
import prisma from "@/lib/prisma";
import { getPublicUrl, makeFilePublic } from "@/lib/gcs";
import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { user } = await validateRequest();
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { fileName } = await req.json();

    // Try to make the file publicly accessible (best effort)
    try {
      await makeFilePublic(fileName);
    } catch (publicError) {
      console.warn(
        "Could not make file public, continuing anyway:",
        publicError
      );
    }

    const media = await prisma.media.create({
      data: {
        url: getPublicUrl(fileName),
        type: "IMAGE",
      },
    });

    return Response.json({ mediaId: media.id, url: media.url });
  } catch (error) {
    console.error("Error completing comment attachment upload:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
