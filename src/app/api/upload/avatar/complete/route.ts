import { validateRequest } from "@/auth";
import prisma from "@/lib/prisma";
import streamServerClient from "@/lib/stream";
import { getPublicUrl, deleteFile, makeFilePublic } from "@/lib/gcs";
import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { user } = await validateRequest();
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { fileName } = await req.json();

    const userFromDb = await prisma.user.findUnique({
      where: { id: user.id },
    });

    if (userFromDb?.avatarUrl) {
      const oldPath = userFromDb.avatarUrl.replace(
        `https://storage.googleapis.com/${process.env.GCS_BUCKET}/`,
        ""
      );
      await deleteFile(oldPath).catch(console.error);
    }

    // Try to make the file publicly accessible (best effort)
    try {
      await makeFilePublic(fileName);
    } catch (publicError) {
      console.warn(
        "Could not make file public, continuing anyway:",
        publicError
      );
    }

    const newAvatarUrl = getPublicUrl(fileName);

    await Promise.all([
      prisma.user.update({
        where: { id: user.id },
        data: { avatarUrl: newAvatarUrl },
      }),
      streamServerClient.partialUpdateUser({
        id: user.id,
        set: { image: newAvatarUrl },
      }),
    ]);

    return Response.json({ avatarUrl: newAvatarUrl });
  } catch (error) {
    console.error("Error completing avatar upload:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
