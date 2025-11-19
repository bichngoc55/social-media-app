import { Prisma } from "@prisma/client";

/**
 * Lightweight user select cho list views (posts, comments)
 * Không load _count và relations để tăng tốc
 */
export function getUserDataSelect(loggedInUserId: string, lightweight = false) {
  const baseSelect = {
    id: true,
    username: true,
    displayName: true,
    avatarUrl: true,
    bio: true,
    createdAt: true,
    followers: {
      where: {
        followerId: loggedInUserId,
      },
      select: {
        followerId: true,
      },
    },
    blockedByUsers: {
      where: {
        blockerId: loggedInUserId,
      },
      select: {
        id: true,
      },
    },
  } satisfies Prisma.UserSelect;

  // Always include _count for FollowButton
  return {
    ...baseSelect,
    _count: {
      select: {
        posts: true,
        followers: true,
        following: true,
      },
    },
  } satisfies Prisma.UserSelect;
}

// Full user data with _count (when lightweight=false)
export type UserData = Prisma.UserGetPayload<{
  select: {
    id: true;
    username: true;
    displayName: true;
    avatarUrl: true;
    bio: true;
    createdAt: true;
    followers: {
      where: {
        followerId: string;
      };
      select: {
        followerId: true;
      };
    };
    blockedByUsers: {
      where: {
        blockerId: string;
      };
      select: {
        id: true;
      };
    };
    _count: {
      select: {
        posts: true;
        followers: true;
      };
    };
  };
}>;

// Lightweight user data without _count (when lightweight=true)
export type UserDataLightweight = Prisma.UserGetPayload<{
  select: {
    id: true;
    username: true;
    displayName: true;
    avatarUrl: true;
    bio: true;
    createdAt: true;
    followers: {
      where: {
        followerId: string;
      };
      select: {
        followerId: true;
      };
    };
    blockedByUsers: {
      where: {
        blockerId: string;
      };
      select: {
        id: true;
      };
    };
  };
}>;

export function getPostDataInclude(
  loggedInUserId: string,
  lightweight = false
) {
  return {
    user: {
      select: getUserDataSelect(loggedInUserId, lightweight),
    },
    attachments: true,
    likes: {
      where: {
        userId: loggedInUserId,
      },
      select: {
        userId: true,
      },
    },
    bookmarks: {
      where: {
        userId: loggedInUserId,
      },
      select: {
        userId: true,
      },
    },
    post_tags: {
      where: {
        status: "APPROVED",
      },
      include: {
        users: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
          },
        },
      },
    },
    _count: {
      select: {
        likes: true,
        comments: true,
      },
    },
  } satisfies Prisma.PostInclude;
}

// Post data with full user data (lightweight=false)
export type PostData = Prisma.PostGetPayload<{
  include: {
    user: {
      select: {
        id: true;
        username: true;
        displayName: true;
        avatarUrl: true;
        bio: true;
        createdAt: true;
        followers: {
          where: {
            followerId: string;
          };
          select: {
            followerId: true;
          };
        };
        blockedByUsers: {
          where: {
            blockerId: string;
          };
          select: {
            id: true;
          };
        };
        _count: {
          select: {
            posts: true;
            followers: true;
          };
        };
      };
    };
    attachments: true;
    likes: {
      where: {
        userId: string;
      };
      select: {
        userId: true;
      };
    };
    bookmarks: {
      where: {
        userId: string;
      };
      select: {
        userId: true;
      };
    };
    _count: {
      select: {
        likes: true;
        comments: true;
      };
    };
  };
}>;

// Post data with lightweight user data (lightweight=true)
export type PostDataLightweight = Prisma.PostGetPayload<{
  include: {
    user: {
      select: {
        id: true;
        username: true;
        displayName: true;
        avatarUrl: true;
        bio: true;
        createdAt: true;
        followers: {
          where: {
            followerId: string;
          };
          select: {
            followerId: true;
          };
        };
        blockedByUsers: {
          where: {
            blockerId: string;
          };
          select: {
            id: true;
          };
        };
      };
    };
    attachments: true;
    likes: {
      where: {
        userId: string;
      };
      select: {
        userId: true;
      };
    };
    bookmarks: {
      where: {
        userId: string;
      };
      select: {
        userId: true;
      };
    };
    _count: {
      select: {
        likes: true;
        comments: true;
      };
    };
  };
}>;

export interface PostsPage {
  posts: PostDataLightweight[];
  nextCursor: string | null;
}

export function getCommentDataInclude(
  loggedInUserId: string,
  lightweight = true
) {
  return {
    user: {
      select: getUserDataSelect(loggedInUserId, lightweight), // Lightweight cho comments
    },
    attachments: true,
    replies: {
      include: {
        user: {
          select: getUserDataSelect(loggedInUserId, lightweight),
        },
        attachments: true,
      },
      orderBy: {
        createdAt: "asc",
      },
    },
  } satisfies Prisma.CommentInclude;
}

export type CommentData = Prisma.CommentGetPayload<{
  include: ReturnType<typeof getCommentDataInclude>;
}>;

export interface CommentsPage {
  comments: CommentData[];
  previousCursor: string | null;
}

export const notificationsInclude = {
  issuer: {
    select: {
      username: true,
      displayName: true,
      avatarUrl: true,
    },
  },
  post: {
    select: {
      content: true,
    },
  },
} satisfies Prisma.NotificationInclude;

export type NotificationData = Prisma.NotificationGetPayload<{
  include: typeof notificationsInclude;
}>;

export interface NotificationsPage {
  notifications: NotificationData[];
  nextCursor: string | null;
}

export interface FollowerInfo {
  followers: number;
  isFollowedByUser: boolean;
}

export interface LikeInfo {
  likes: number;
  isLikedByUser: boolean;
}

export interface BookmarkInfo {
  isBookmarkedByUser: boolean;
}

export interface NotificationCountInfo {
  unreadCount: number;
}

export interface MessageCountInfo {
  unreadCount: number;
}
