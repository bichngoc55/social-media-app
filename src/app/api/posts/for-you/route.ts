import { validateRequest } from "@/auth";
import prisma from "@/lib/prisma";
import { getPostDataInclude, PostsPage } from "@/lib/types";
import { getCachedBlockedUsers, getCachedFollowingUsers } from "@/lib/cache";
import { recommendPostsForUser } from "@/lib/ai-api";
import { NextRequest } from "next/server";

// Tối ưu: Cache route config
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 30; // 30 seconds max duration for Vercel

export async function GET(req: NextRequest) {
  try {
    const cursor = req.nextUrl.searchParams.get("cursor") || undefined;
    const pageSize = 10;

    const { user } = await validateRequest();

    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log(
      `[for-you] Fetching recommendations for user: ${user.id} (${user.username})`
    );

    // Tối ưu: Sử dụng cached data thay vì query mỗi lần
    const [blockedUserIds, followingUserIds] = await Promise.all([
      getCachedBlockedUsers(user.id),
      getCachedFollowingUsers(user.id),
    ]);

    // Lấy user data để tính AI recommendations
    const currentUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        username: true,
        displayName: true,
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
      return Response.json({ error: "User not found" }, { status: 404 });
    }

    // Lấy candidate posts (chỉ PUBLIC, không phải của user, không bị block)
    // Lấy nhiều hơn để có đủ data cho AI recommendations
    const candidatePosts = await prisma.post.findMany({
      where: {
        AND: [
          {
            userId: {
              notIn:
                blockedUserIds.size > 0
                  ? Array.from(blockedUserIds)
                  : undefined,
            },
          },
          {
            privacy: "PUBLIC", // CHỈ lấy PUBLIC posts
          },
          {
            userId: { not: user.id }, // Không lấy posts của chính user
          },
        ],
      },
      select: {
        id: true,
        content: true,
        userId: true,
        comments: {
          select: { content: true },
          take: 50,
        },
      },
      take: 200, // Giảm xuống 200 để tăng tốc độ (vẫn đủ để AI recommend)
    });

    // Nếu không có candidate posts, kiểm tra xem có posts PUBLIC nào trong database không
    if (candidatePosts.length === 0) {
      console.log(`[for-you] No candidate posts found for user: ${user.id}`);

      // Kiểm tra xem có posts PUBLIC nào trong database không (để debug)
      const totalPublicPosts = await prisma.post.count({
        where: { privacy: "PUBLIC" },
      });
      console.log(
        `[for-you] Total PUBLIC posts in database: ${totalPublicPosts}`
      );

      // Nếu không có posts nào, trả về empty
      if (totalPublicPosts === 0) {
        console.log(`[for-you] No PUBLIC posts in database at all`);
        return Response.json({
          posts: [],
          nextCursor: null,
        });
      }

      // Nếu có posts nhưng tất cả đều của user này, vẫn trả về empty
      // (vì "For you" feed không nên hiển thị posts của chính user)
      console.log(`[for-you] All PUBLIC posts belong to user ${user.id}`);
      return Response.json({
        posts: [],
        nextCursor: null,
      });
    }

    console.log(`[for-you] Found ${candidatePosts.length} candidate posts`);

    // Format user data
    const userData = {
      id: currentUser.id,
      username: currentUser.username,
      displayName: currentUser.displayName,
      post_contents: currentUser.posts.map((p) => p.content).filter(Boolean),
      liked_post_contents: currentUser.likes
        .map((l) => l.post?.content)
        .filter(Boolean) as string[],
      comment_contents: currentUser.comments
        .map((c) => c.content)
        .filter(Boolean),
      following_ids: currentUser.following.map((f) => f.followingId),
    };

    // Format posts data
    const postsData = candidatePosts.map((p) => ({
      id: p.id,
      content: p.content,
      userId: p.userId,
      comment_contents: p.comments.map((c) => c.content),
    }));

    // Parse cursor để lấy exclude post IDs (posts đã được hiển thị)
    const excludePostIds: string[] = cursor
      ? cursor.split(",").filter(Boolean)
      : [];

    // Gọi Python AI API để recommend posts
    let recommendedPostIds: string[] = [];

    try {
      console.log(`[for-you] Calling Python AI API for user: ${user.id}`);
      console.log(`[for-you] Sending ${postsData.length} posts to AI API`);
      console.log(`[for-you] Excluding ${excludePostIds.length} post IDs`);

      const recommendations = await recommendPostsForUser(
        user.id,
        userData,
        postsData,
        excludePostIds
      );

      console.log(`[for-you] Python AI API response:`, {
        count: recommendations.length,
        sample: recommendations
          .slice(0, 3)
          .map((r) => ({ id: r.id, similarity: r.similarity })),
      });

      // Lấy top posts (đã được sắp xếp theo similarity)
      recommendedPostIds = recommendations.map((r) => r.id);
      console.log(
        `[for-you] AI API returned ${recommendedPostIds.length} recommendations`
      );

      // Nếu Python API trả về empty, log để debug
      if (recommendedPostIds.length === 0) {
        console.warn(`[for-you] Python AI API returned empty recommendations!`);
        console.warn(`[for-you] User data:`, {
          post_contents_count: userData.post_contents.length,
          liked_post_contents_count: userData.liked_post_contents.length,
          comment_contents_count: userData.comment_contents.length,
        });
      }
    } catch (pythonError) {
      console.error(
        "[for-you] Python AI API error, using fallback:",
        pythonError
      );

      // Log chi tiết lỗi
      if (pythonError instanceof Error) {
        console.error("[for-you] Python error message:", pythonError.message);
        console.error("[for-you] Python error stack:", pythonError.stack);
      }

      // Fallback: lấy posts mới nhất nếu AI API không available
      console.log(`[for-you] Using fallback: fetching latest PUBLIC posts`);
      const fallbackPosts = await prisma.post.findMany({
        where: {
          AND: [
            {
              userId: {
                notIn:
                  blockedUserIds.size > 0
                    ? Array.from(blockedUserIds)
                    : undefined,
              },
            },
            { privacy: "PUBLIC" },
            { userId: { not: user.id } },
            // Exclude posts đã hiển thị
            ...(excludePostIds.length > 0
              ? [{ id: { notIn: excludePostIds } }]
              : []),
          ],
        },
        select: { id: true },
        orderBy: { createdAt: "desc" },
        take: pageSize + 1,
      });

      recommendedPostIds = fallbackPosts.map((p) => p.id);
      console.log(
        `[for-you] Fallback returned ${recommendedPostIds.length} posts`
      );

      // Nếu fallback cũng không có posts, log để debug
      if (recommendedPostIds.length === 0) {
        console.log(
          `[for-you] Fallback also returned no posts. Checking database...`
        );
        const checkPosts = await prisma.post.findMany({
          where: { privacy: "PUBLIC" },
          select: { id: true, userId: true },
          take: 10,
        });
        console.log(
          `[for-you] Sample PUBLIC posts in DB:`,
          checkPosts.map((p) => ({ id: p.id, userId: p.userId }))
        );
      }
    }

    // Nếu không có recommended posts, trả về empty
    if (recommendedPostIds.length === 0) {
      console.log(`[for-you] No recommended posts found for user: ${user.id}`);
      return Response.json({
        posts: [],
        nextCursor: null,
      });
    }

    // Lấy full post data cho recommended posts
    console.log(
      `[for-you] Fetching full data for ${recommendedPostIds.length} recommended posts`
    );
    const posts = await prisma.post.findMany({
      where: {
        id: {
          in: recommendedPostIds,
        },
      },
      include: getPostDataInclude(user.id, true), // Lightweight mode cho list
    });

    console.log(
      `[for-you] Found ${posts.length} posts in database (with valid users)`
    );

    // Nếu số posts ít hơn số recommended IDs, có thể một số posts/user đã bị xóa
    if (posts.length < recommendedPostIds.length) {
      const missingIds = recommendedPostIds.filter(
        (id) => !posts.find((p) => p.id === id)
      );
      console.warn(
        `[for-you] ${missingIds.length} recommended post IDs not found or have deleted users:`,
        missingIds.slice(0, 5) // Log 5 đầu tiên
      );
    }

    // Kiểm tra posts có đủ data không
    if (posts.length > 0) {
      const samplePost = posts[0];
      console.log(`[for-you] Sample post data:`, {
        id: samplePost.id,
        hasUser: !!samplePost.user,
        userId: samplePost.userId,
        userData: samplePost.user
          ? {
              id: samplePost.user.id,
              username: samplePost.user.username,
              displayName: samplePost.user.displayName,
            }
          : null,
        hasAttachments: !!samplePost.attachments,
        attachmentsCount: samplePost.attachments?.length || 0,
      });
    }

    // Sắp xếp posts theo thứ tự recommended (giữ nguyên thứ tự từ AI)
    const sortedPosts = recommendedPostIds
      .map((id) => posts.find((p) => p.id === id))
      .filter((p): p is NonNullable<typeof p> => p !== undefined);

    console.log(
      `[for-you] After sorting and filtering: ${sortedPosts.length} posts`
    );

    // Kiểm tra sorted posts có đủ data không
    const postsWithoutUser = sortedPosts.filter((p) => !p.user);
    if (postsWithoutUser.length > 0) {
      console.warn(
        `[for-you] Found ${postsWithoutUser.length} posts without user data:`,
        postsWithoutUser.map((p) => p.id)
      );
    }

    // Filter out posts without user data (quan trọng: phải có user để render)
    const validPosts = sortedPosts.filter(
      (p) => p.user !== null && p.user !== undefined
    );

    console.log(
      `[for-you] After filtering posts with user: ${validPosts.length} valid posts (from ${sortedPosts.length} total)`
    );

    // Pagination: lấy pageSize posts
    const postsToReturn = validPosts.slice(0, pageSize);

    // Next cursor: danh sách tất cả post IDs đã được hiển thị (bao gồm cả page hiện tại)
    const allExcludedIds = [
      ...excludePostIds,
      ...postsToReturn.map((p) => p.id),
    ];
    const nextCursor =
      sortedPosts.length > pageSize || recommendedPostIds.length > pageSize
        ? allExcludedIds.join(",")
        : null;

    // Kiểm tra lại trước khi trả về
    const postsWithUser = postsToReturn.filter((p) => p.user);
    if (postsWithUser.length !== postsToReturn.length) {
      console.warn(
        `[for-you] Warning: ${postsToReturn.length - postsWithUser.length} posts without user were filtered out`
      );
    }

    const data: PostsPage = {
      posts: postsWithUser,
      nextCursor: postsWithUser.length > 0 ? nextCursor : null, // Chỉ set cursor nếu có posts hợp lệ
    };

    console.log(
      `[for-you] Returning ${postsWithUser.length} posts for user: ${user.id}`
    );
    console.log(
      `[for-you] Response data:`,
      JSON.stringify({
        postsCount: postsWithUser.length,
        nextCursor: data.nextCursor
          ? `${data.nextCursor.split(",").length} excluded IDs`
          : null,
        firstPostId: postsWithUser[0]?.id || null,
        firstPostHasUser: !!postsWithUser[0]?.user,
      })
    );

    return Response.json(data);
  } catch (error) {
    console.error("Error in for-you route:", error);
    // Log chi tiết lỗi để debug
    if (error instanceof Error) {
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);
    }
    // Trả về empty posts thay vì lỗi để app vẫn hoạt động
    return Response.json(
      {
        posts: [],
        nextCursor: null,
      },
      { status: 200 }
    );
  }
}
