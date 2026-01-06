"use server";

import { validateRequest } from "@/auth";
import prisma from "@/lib/prisma";
import { getTextEmbedding } from "@/lib/vertex";
import streamServerClient from "@/lib/stream";
import { getUserDataSelect } from "@/lib/types";
import {
  updateUserProfileSchema,
  UpdateUserProfileValues,
} from "@/lib/validation";

export async function updateUserProfile(values: UpdateUserProfileValues) {
  try {
    const validatedValues = updateUserProfileSchema.parse(values);

    const { user } = await validateRequest();
    if (!user) throw new Error("Unauthorized");

    const updatedUser = await prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id: user.id },
        data: {
          displayName: validatedValues.displayName,
          bio: validatedValues.bio,
          interests: validatedValues.interests,
          countryCode: validatedValues.countryCode || null,
          provinceCode: validatedValues.provinceCode || null,
          districtCode: validatedValues.districtCode || null,
        },
        select: getUserDataSelect(user.id),
      });

      await streamServerClient.partialUpdateUser({
        id: user.id,
        set: {
          name: validatedValues.displayName,
        },
      });

      return updated;
    });

    if (validatedValues.interests && validatedValues.interests.length > 0) {
      await handleInterestsEmbeddings(user.id, validatedValues.interests);
    }

    return updatedUser;
  } catch (error: any) {
    console.error("USER_PROFILE_UPDATE_ERROR:", error);
    throw new Error(
      error.message ||
        "An unexpected error occurred while updating your profile."
    );
  }
}

async function handleInterestsEmbeddings(userId: string, interests: string[]) {
  try {
    const embeddings = await Promise.all(
      interests.map((topic) => getTextEmbedding(topic))
    );

    const vectorStrings: string[] = embeddings.map(
      (emb) => `[${emb.join(",")}]`
    );

    await prisma.$executeRaw`
      UPDATE users
      SET "topicEmbeddings" = ${vectorStrings}::vector[]
      WHERE id = ${userId}
    `;
  } catch (sqlError) {
    console.error("EMBEDDING_SQL_ERROR:", sqlError);
  }
}
