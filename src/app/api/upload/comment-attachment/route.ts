import { validateRequest } from "@/auth";
import { generateUploadSignedUrl } from "@/lib/gcs";
import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { user } = await validateRequest();
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { contentType, fileSize } = await req.json();

    const isImage = contentType.startsWith("image/");
    const isVideo = contentType.startsWith("video/");

    if (!isImage && !isVideo) {
      return Response.json(
        { error: "Only images and videos are allowed" },
        { status: 400 }
      );
    }

    const imageLimit = 20 * 1024 * 1024; // 20MB
    const videoLimit = 64 * 1024 * 1024; // 64MB

    if (isImage && fileSize > imageLimit) {
      return Response.json(
        { error: "Image too large. Max 20MB" },
        { status: 400 }
      );
    }

    if (isVideo && fileSize > videoLimit) {
      return Response.json(
        { error: "Video too large. Max 64MB" },
        { status: 400 }
      );
    }

    const extension = contentType.split("/")[1];
    const fileName = `comments/${user.id}/${crypto.randomUUID()}.${extension}`;

    const uploadUrl = await generateUploadSignedUrl(
      fileName,
      contentType,
      15,
      isVideo ? videoLimit : imageLimit
    );

    return Response.json({ uploadUrl, fileName });
  } catch (error) {
    console.error("Error generating comment attachment upload URL:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
