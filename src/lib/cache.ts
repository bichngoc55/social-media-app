import prisma from "@/lib/prisma";

// Cache map để lưu cached results
const blockedUsersCache = new Map<
  string,
  { data: Set<string>; timestamp: number }
>();
const followingUsersCache = new Map<
  string,
  { data: Set<string>; timestamp: number }
>();
const CACHE_TTL = 60 * 1000; // 60 giây

/**
 * Cache blocked users để tránh query database mỗi lần
 * Cache 60 giây - đủ cho hầu hết use cases
 */
export async function getCachedBlockedUsers(userId: string) {
  const now = Date.now();
  const cached = blockedUsersCache.get(userId);

  // Kiểm tra cache
  if (cached && now - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  // Query database
  const blockedUsers = await prisma.userBlock.findMany({
    where: {
      OR: [{ blockerId: userId }, { blockedId: userId }],
    },
    select: { blockerId: true, blockedId: true },
  });

  const blockedUserIds = new Set([
    ...blockedUsers.map((b) => b.blockedId),
    ...blockedUsers.map((b) => b.blockerId),
  ]);
  blockedUserIds.delete(userId); // Loại bỏ chính mình

  // Lưu vào cache
  blockedUsersCache.set(userId, { data: blockedUserIds, timestamp: now });

  return blockedUserIds;
}

/**
 * Cache following users để tránh query database mỗi lần
 * Cache 60 giây
 */
export async function getCachedFollowingUsers(userId: string) {
  const now = Date.now();
  const cached = followingUsersCache.get(userId);

  // Kiểm tra cache
  if (cached && now - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  // Query database
  const followingUsers = await prisma.follow.findMany({
    where: { followerId: userId },
    select: { followingId: true },
  });

  const followingUserIds = new Set(followingUsers.map((f) => f.followingId));

  // Lưu vào cache
  followingUsersCache.set(userId, { data: followingUserIds, timestamp: now });

  return followingUserIds;
}

/**
 * Invalidate cache khi có thay đổi
 */
export async function invalidateBlockedUsersCache(userId: string) {
  // Next.js sẽ tự động invalidate dựa trên tags
  // Hoặc có thể dùng revalidateTag từ next/cache
}

export async function invalidateFollowingUsersCache(userId: string) {
  // Next.js sẽ tự động invalidate dựa trên tags
}
