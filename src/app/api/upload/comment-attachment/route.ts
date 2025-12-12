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

    if (!contentType.startsWith("image/")) {
      return Response.json(
        { error: "Only images are allowed" },
        { status: 400 }
      );
    }

    if (fileSize > 2 * 1024 * 1024) {
      return Response.json(
        { error: "File too large. Max 2MB" },
        { status: 400 }
      );
    }

    const extension = contentType.split("/")[1];
    const fileName = `comments/${user.id}/${crypto.randomUUID()}.${extension}`;

    const uploadUrl = await generateUploadSignedUrl(
      fileName,
      contentType,
      15,
      2 * 1024 * 1024
    );

    return Response.json({ uploadUrl, fileName });
  } catch (error) {
    console.error("Error generating comment attachment upload URL:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
