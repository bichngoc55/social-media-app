import { google, lucia } from "@/auth";
import kyInstance from "@/lib/ky";
import prisma from "@/lib/prisma";
import streamServerClient from "@/lib/stream";
import { slugify } from "@/lib/utils";
import { OAuth2RequestError } from "arctic";
import { generateIdFromEntropySize } from "lucia";
import { cookies } from "next/headers";
import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");

  const storedState = (await cookies()).get("state")?.value;
  const storedCodeVerifier = (await cookies()).get("code_verifier")?.value;

  if (
    !code ||
    !state ||
    !storedState ||
    !storedCodeVerifier ||
    state !== storedState
  ) {
    return new Response(null, { status: 400 });
  }

  try {
    const tokens = await google.validateAuthorizationCode(
      code,
      storedCodeVerifier
    );

    const googleUser = await kyInstance
      .get("https://www.googleapis.com/oauth2/v1/userinfo", {
        headers: {
          Authorization: `Bearer ${tokens.accessToken}`,
        },
      })
      .json<{ id: string; name: string; email: string }>();

    // Tìm user theo googleId trước
    let existingUser = await prisma.user.findUnique({
      where: {
        googleId: googleUser.id,
      },
      select: {
        id: true,
        emailVerified: true,
        email: true,
      },
    });

    // Nếu không tìm thấy theo googleId, tìm theo email
    if (!existingUser && googleUser.email) {
      existingUser = await prisma.user.findUnique({
        where: {
          email: googleUser.email.toLowerCase(),
        },
        select: {
          id: true,
          emailVerified: true,
          email: true,
        },
      });

      // Nếu tìm thấy user theo email, cập nhật googleId
      if (existingUser) {
        await prisma.user.update({
          where: { id: existingUser.id },
          data: {
            googleId: googleUser.id,
            emailVerified: true, // Google users tự động xác thực email
          },
        });
      }
    }

    if (existingUser) {
      // Đảm bảo Google users luôn được xác thực email
      if (!existingUser.emailVerified) {
        await prisma.user.update({
          where: { id: existingUser.id },
          data: { emailVerified: true },
        });
      }

      const session = await lucia.createSession(existingUser.id, {});
      const sessionCookie = lucia.createSessionCookie(session.id);
      (await cookies()).set(
        sessionCookie.name,
        sessionCookie.value,
        sessionCookie.attributes
      );
      return new Response(null, {
        status: 302,
        headers: {
          Location: "/",
        },
      });
    }

    const userId = generateIdFromEntropySize(10);

    const username = slugify(googleUser.name) + "-" + userId.slice(0, 4);

    await prisma.$transaction(async (tx) => {
      await tx.user.create({
        data: {
          id: userId,
          username,
          displayName: googleUser.name,
          email: googleUser.email?.toLowerCase(),
          googleId: googleUser.id,
          emailVerified: true, // Google users tự động xác thực email
        },
      });
      await streamServerClient.upsertUser({
        id: userId,
        username,
        name: username,
      });
    });

    const session = await lucia.createSession(userId, {});
    const sessionCookie = lucia.createSessionCookie(session.id);
    (await cookies()).set(
      sessionCookie.name,
      sessionCookie.value,
      sessionCookie.attributes
    );

    return new Response(null, {
      status: 302,
      headers: {
        Location: "/",
      },
    });
  } catch (error) {
    console.error(error);
    if (error instanceof OAuth2RequestError) {
      return new Response(null, {
        status: 400,
      });
    }
    return new Response(null, {
      status: 500,
    });
  }
}
