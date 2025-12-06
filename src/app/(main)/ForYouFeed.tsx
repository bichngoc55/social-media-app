"use client";

import InfiniteScrollContainer from "@/components/InfiniteScrollContainer";
import Post from "@/components/posts/Post";
import PostsLoadingSkeleton from "@/components/posts/PostsLoadingSkeleton";
import { Button } from "@/components/ui/button";
import kyInstance from "@/lib/ky";
import { PostsPage } from "@/lib/types";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

export default function ForYouFeed() {
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetching,
    isFetchingNextPage,
    status,
  } = useInfiniteQuery({
    queryKey: ["post-feed", "for-you"],
    queryFn: async ({ pageParam }) => {
      try {
        // Tăng timeout lên 60 giây vì AI API cần thời gian xử lý
        const response = await kyInstance.get("/api/posts/for-you", {
          ...(pageParam ? { searchParams: { cursor: pageParam } } : {}),
          timeout: 60000, // 60 seconds
        });
        const data = await response.json<PostsPage>();

        return data;
      } catch (error) {
        console.error("[ForYouFeed] Error fetching posts:", error);
        throw error;
      }
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    gcTime: 0, // Clear cache immediately để debug
  });

  const posts = data?.pages.flatMap((page) => page.posts) || [];

  if (status === "pending") {
    return <PostsLoadingSkeleton />;
  }

  if (status === "success" && !posts.length && !hasNextPage) {
    return (
      <p className="text-center text-muted-foreground">
        No one has posted anything yet.
      </p>
    );
  }

  if (status === "error") {
    return (
      <div className="space-y-2 text-center">
        <p className="text-destructive">
          An error occurred while loading posts.
        </p>
        <Button
          onClick={() => window.location.reload()}
          variant="outline"
          size="sm"
        >
          Retry
        </Button>
      </div>
    );
  }

  // Nếu có posts nhưng không render được, log để debug
  if (status === "success" && posts.length > 0) {
    const postsWithUser = posts.filter((p) => p.user);
    const postsWithoutUser = posts.filter((p) => !p.user);

    console.log("[ForYouFeed] Rendering posts:", {
      totalPosts: posts.length,
      postsWithUser: postsWithUser.length,
      postsWithoutUser: postsWithoutUser.length,
      samplePost: postsWithUser[0]
        ? {
            id: postsWithUser[0].id,
            content: postsWithUser[0].content?.substring(0, 50),
            userId: postsWithUser[0].userId,
            hasUser: !!postsWithUser[0].user,
            userData: postsWithUser[0].user
              ? {
                  id: postsWithUser[0].user.id,
                  username: postsWithUser[0].user.username,
                }
              : null,
          }
        : null,
    });

    if (postsWithoutUser.length > 0) {
      console.warn(
        `[ForYouFeed] ${postsWithoutUser.length} posts will be skipped (no user data):`,
        postsWithoutUser.map((p) => p.id).slice(0, 5)
      );
    }
  }

  return (
    <div className="space-y-5">
      <InfiniteScrollContainer
        className="space-y-5"
        onBottomReached={() => {
          if (hasNextPage && !isFetching && !isFetchingNextPage) {
            fetchNextPage();
          }
        }}
      >
        {posts.map((post) => {
          if (!post || !post.id) {
            console.warn("[ForYouFeed] Invalid post:", post);
            return null;
          }
          if (!post.user) {
            console.warn("[ForYouFeed] Post missing user:", post.id);
            return null;
          }
          return <Post key={post.id} post={post} />;
        })}
        {isFetchingNextPage && (
          <Loader2 className="mx-auto my-3 animate-spin" />
        )}
      </InfiniteScrollContainer>

      {/* See more button - hiển thị khi có nhiều hơn 10 posts và không đang fetch */}
      {hasNextPage && !isFetchingNextPage && posts.length >= 10 && (
        <div className="flex justify-center pt-4">
          <Button
            onClick={() => fetchNextPage()}
            variant="outline"
            disabled={isFetching || isFetchingNextPage}
            className="w-full sm:w-auto"
          >
            {isFetching || isFetchingNextPage ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading...
              </>
            ) : (
              "See more"
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
