import { validateRequest } from "@/auth";
import prisma from "@/lib/prisma";
import { generateDownloadSignedUrl } from "@/lib/gcs";

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { user } = await validateRequest();
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const media = await prisma.media.findUnique({
      where: { id: params.id },
    });

    if (!media) {
      return Response.json({ error: "Media not found" }, { status: 404 });
    }

    // Extract file path from stored URL
    const filePath = media.url.replace(
      `https://storage.googleapis.com/${process.env.GCS_BUCKET}/`,
      ""
    );

    // Generate signed URL valid for 1 hour
    const signedUrl = await generateDownloadSignedUrl(filePath, 60);

    return Response.json({ url: signedUrl });
  } catch (error) {
    console.error("Error generating media URL:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
