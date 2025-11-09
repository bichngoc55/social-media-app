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

      // Return only plain serializable data to the client action boundary.
      // Returning the full `user` object (with Dates/prototypes) can cause
      // React Server Actions serialization errors. Send only the user id.
      return { userId: user.id };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      const userId = (metadata as { userId?: string }).userId;

      if (!userId) throw new UploadThingError("Missing userId in metadata");

      const userFromDb = await prisma.user.findUnique({
        where: { id: userId },
      });
      const oldAvatarUrl = userFromDb?.avatarUrl;

      if (oldAvatarUrl) {
        const key = oldAvatarUrl.split(
          `/a/${process.env.UPLOADTHING_APP_ID}/`
        )[1];
        if (key) await new UTApi().deleteFiles(key);
      }

      const newAvatarUrl = file.url.replace(
        "/f/",
        `/a/${process.env.UPLOADTHING_APP_ID}/`
      );

      await Promise.all([
        prisma.user.update({
          where: { id: userId },
          data: { avatarUrl: newAvatarUrl },
        }),
        streamServerClient.partialUpdateUser({
          id: userId,
          set: { image: newAvatarUrl },
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
  commentAttachment: f({
    image: { maxFileSize: "2MB", maxFileCount: 3 },
  })
    .middleware(async () => {
      const { user } = await validateRequest();

      if (!user) throw new UploadThingError("Unauthorized");

      return { userId: user.id };
    })
    .onUploadComplete(async ({ file }) => {
      const media = await prisma.media.create({
        data: {
          url: file.url.replace("/f/", `/a/${process.env.UPLOADTHING_APP_ID}/`),
          type: "IMAGE",
        },
      });

      return { mediaId: media.id, url: media.url };
    }),
} satisfies FileRouter;

export type AppFileRouter = typeof fileRouter;
