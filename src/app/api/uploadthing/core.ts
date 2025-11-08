import { validateRequest } from "@/auth";
import prisma from "@/lib/prisma";
import streamServerClient from "@/lib/stream";
import { createUploadthing, FileRouter } from "uploadthing/next";
import { UploadThingError, UTApi } from "uploadthing/server";

const f = createUploadthing();

export const fileRouter = {
  avatar: f({
    image: { maxFileSize: "512KB" },
  })
    .middleware(async () => {
      const { user } = await validateRequest();

      if (!user) throw new UploadThingError("Unauthorized");

      return { user };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      const oldAvatarUrl = metadata.user.avatarUrl;

      if (oldAvatarUrl) {
        const key = oldAvatarUrl.split(
          `/a/${process.env.UPLOADTHING_APP_ID}/`
        )[1];

        await new UTApi().deleteFiles(key);
      }

      const newAvatarUrl = file.url.replace(
        "/f/",
        `/a/${process.env.UPLOADTHING_APP_ID}/`
      );

      await Promise.all([
        prisma.user.update({
          where: { id: metadata.user.id },
          data: {
            avatarUrl: newAvatarUrl,
          },
        }),
        streamServerClient.partialUpdateUser({
          id: metadata.user.id,
          set: {
            image: newAvatarUrl,
          },
        }),
      ]);

      return { avatarUrl: newAvatarUrl };
    }),
  attachment: f({
    image: { maxFileSize: "4MB", maxFileCount: 20 },
    video: { maxFileSize: "64MB", maxFileCount: 20 },
  })
    .middleware(async () => {
      const { user } = await validateRequest();

      if (!user) throw new UploadThingError("Unauthorized");

      return {};
    })
    .onUploadComplete(async ({ file }) => {
      try {
        const media = await prisma.media.create({
          data: {
            url: file.url.replace(
              "/f/",
              `/a/${process.env.UPLOADTHING_APP_ID}/`
            ),
            type: file.type.startsWith("image") ? "IMAGE" : "VIDEO",
          },
        });

        console.log(`✅ Media created: ${media.id} for file: ${file.name}`);
        return { mediaId: media.id };
      } catch (error) {
        console.error("❌ Error in uploadthing onUploadComplete:", error);
        // Không throw error để không làm gián đoạn response stream
        // Files vẫn được upload lên S3 thành công
        // Chỉ log error và return null mediaId
        console.warn(
          "⚠️ Upload succeeded but failed to save to database. File URL:",
          file.url
        );
        return {
          mediaId: null,
          error:
            error instanceof Error
              ? error.message
              : "Failed to save to database",
          fileUrl: file.url,
        };
      }
    }),
} satisfies FileRouter;

export type AppFileRouter = typeof fileRouter;
