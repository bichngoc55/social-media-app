/**
 * API route để recommend friends sử dụng Hugging Face BGE-M3 embeddings
 * Next.js sẽ fetch data từ Prisma, format và gửi cho Python API
 */

import { validateRequest } from "@/auth";
import prisma from "@/lib/prisma";
import { getUserDataSelect } from "@/lib/types";
import { recommendFriends } from "@/lib/ai-api";
import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 30; // 30 seconds max duration for Vercel

export async function GET(req: NextRequest) {
  try {
    const { user } = await validateRequest();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if request was aborted
    if (req.signal?.aborted) {
      return NextResponse.json({ error: "Request aborted" }, { status: 499 });
    }

    // Lấy data của user hiện tại
    const currentUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        username: true,
        displayName: true,
        provinceCode: true,
        districtCode: true,
        wardCode: true,
        posts: {
          where: { privacy: "PUBLIC" },
          select: { content: true },
          take: 100,
        },
        likes: {
          select: {
            post: {
              select: { content: true },
            },
          },
          take: 100,
        },
        comments: {
          select: { content: true },
          take: 100,
        },
        following: {
          select: { followingId: true },
        },
      },
    });

    if (!currentUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Lấy candidate users (không follow, có posts)
    const candidateUsers = await prisma.user.findMany({
      where: {
        NOT: { id: user.id },
        followers: { none: { followerId: user.id } },
        posts: { some: { privacy: "PUBLIC" } },
      },
      select: {
        id: true,
        username: true,
        displayName: true,
        provinceCode: true,
        districtCode: true,
        wardCode: true,
        posts: {
          where: { privacy: "PUBLIC" },
          select: { content: true },
          take: 50,
        },
        likes: {
          select: {
            post: {
              select: { content: true },
            },
          },
          take: 50,
        },
        comments: {
          select: { content: true },
          take: 50,
        },
        following: {
          select: { followingId: true },
        },
      },
      take: 200, // Limit để tránh quá tải
    });

    // Format data để gửi cho Python API
    const usersData = [
      {
        id: currentUser.id,
        username: currentUser.username,
        displayName: currentUser.displayName,
        post_contents: currentUser.posts.map((p) => p.content),
        liked_post_contents: currentUser.likes
          .map((l) => l.post.content)
          .filter(Boolean),
        comment_contents: currentUser.comments.map((c) => c.content),
        following_ids: currentUser.following.map((f) => f.followingId),
        province_code: currentUser.provinceCode,
        district_code: currentUser.districtCode,
        ward_code: currentUser.wardCode,
      },
      ...candidateUsers.map((u) => ({
        id: u.id,
        username: u.username,
        displayName: u.displayName,
        post_contents: u.posts.map((p) => p.content),
        liked_post_contents: u.likes.map((l) => l.post.content).filter(Boolean),
        comment_contents: u.comments.map((c) => c.content),
        following_ids: u.following.map((f) => f.followingId),
        province_code: u.provinceCode,
        district_code: u.districtCode,
        ward_code: u.wardCode,
      })),
    ];

    // Gọi Python AI API (Hugging Face BGE-M3)
    try {
      const recommendations = await recommendFriends(user.id, usersData);

      // Lấy full user data cho recommended users
      const recommendedUserIds = recommendations.map((r) => r.id);
      const recommendedUsers = await prisma.user.findMany({
        where: { id: { in: recommendedUserIds } },
        select: getUserDataSelect(user.id, false),
      });

      // Sắp xếp theo similarity score
      const userMap = new Map(recommendedUsers.map((u) => [u.id, u]));
      const sortedUsers = recommendations
        .map((rec) => ({
          user: userMap.get(rec.id),
          similarity: rec.similarity,
        }))
        .filter((item) => item.user)
        .map((item) => item.user!);

      return NextResponse.json({
        users: sortedUsers,
        similarities: Object.fromEntries(
          recommendations.map((r) => [r.id, r.similarity])
        ),
      });
    } catch (pythonError) {
      console.error("Python AI API error, using fallback:", pythonError);
      // Fallback: simple query
      const fallbackUsers = await prisma.user.findMany({
        where: {
          NOT: { id: user.id },
          followers: { none: { followerId: user.id } },
        },
        select: getUserDataSelect(user.id, false),
        take: 5,
        orderBy: { createdAt: "desc" },
      });

      return NextResponse.json({
        users: fallbackUsers,
        similarities: {},
        metadata: { message: "Python AI API unavailable, using fallback." },
      });
    }
  } catch (error) {
    console.error("Error in AI recommend-friends route:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
