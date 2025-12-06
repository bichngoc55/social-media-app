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

    const maxSize = isImage ? 4 * 1024 * 1024 : 64 * 1024 * 1024;
    if (fileSize > maxSize) {
      return Response.json(
        { error: `File too large. Max ${isImage ? "4MB" : "64MB"}` },
        { status: 400 }
      );
    }

    const extension = contentType.split("/")[1];
    const fileName = `attachments/${user.id}/${crypto.randomUUID()}.${extension}`;

    const uploadUrl = await generateUploadSignedUrl(
      fileName,
      contentType,
      15,
      maxSize
    );

    return Response.json({ uploadUrl, fileName });
  } catch (error) {
    console.error("Error generating attachment upload URL:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
